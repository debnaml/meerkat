import Link from "next/link";
import { notFound } from "next/navigation";

import { ChangeTimelineChart } from "@/components/change-timeline-chart";
import { StatusBadge } from "@/components/status-badge";
import { MonitorSettingsForm, type EditableMonitor } from "./monitor-settings-form";
import { MonitorActionsMenu } from "./monitor-actions-menu";
import { formatDate, formatRelative, describeInterval } from "@/lib/formatters";
import { getServerComponentClient } from "@/lib/supabase/server-clients";

interface MonitorRecord {
  id: string;
  name: string;
  url: string;
  type: "page" | "section" | "visual";
  selector_css: string | null;
  interval_minutes: number;
  sensitivity: "strict" | "normal" | "relaxed";
  enabled: boolean;
  last_checked_at: string | null;
  last_change_at: string | null;
  last_status: string | null;
  created_at: string | null;
}

interface ChangeRecord {
  id: string;
  created_at: string;
  summary: string | null;
  severity: "low" | "medium" | "high" | null;
}

interface CheckRecord {
  id: string;
  started_at: string;
  status: string;
  http_status: number | null;
  error_message: string | null;
}

interface SnapshotDetail {
  id: string;
  text_normalized: string | null;
  content_hash: string | null;
}

interface DiffSegment {
  kind: "context" | "added" | "removed";
  text: string;
}

interface DiffBlob {
  type?: string;
  before_excerpt?: string | null;
  after_excerpt?: string | null;
  word_delta?: number | null;
  before_segments?: DiffSegment[];
  after_segments?: DiffSegment[];
  truncated_prefix?: boolean;
  truncated_suffix?: boolean;
  [key: string]: unknown;
}

interface ChangeEventDetail {
  id: string;
  created_at: string;
  summary: string | null;
  severity: "low" | "medium" | "high" | null;
  diff_blob: DiffBlob | null;
  prev_snapshot: SnapshotDetail | null;
  next_snapshot: SnapshotDetail | null;
}

function buildTimeline(changes: ChangeRecord[], days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bucket = new Map<string, number>();

  changes.forEach((change) => {
    const changeDate = new Date(change.created_at);
    if (Number.isNaN(changeDate.valueOf())) {
      return;
    }
    changeDate.setHours(0, 0, 0, 0);
    const key = changeDate.toISOString().slice(0, 10);
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  });

  return Array.from({ length: days }, (_value, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: bucket.get(key) ?? 0,
    };
  });
}

function severityBadge(severity: ChangeRecord["severity"]) {
  if (!severity) return "bg-[var(--color-neutral-soft)] text-[var(--color-neutral-ink)]";
  switch (severity) {
    case "high":
      return "bg-[var(--color-danger-soft)] text-[var(--color-danger-ink)]";
    case "medium":
      return "bg-[var(--color-warning-soft)] text-[var(--color-warning-ink)]";
    default:
      return "bg-[var(--color-success-soft)] text-[var(--color-success-ink)]";
  }
}

export default async function MonitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerComponentClient();

  const { data: monitor, error: monitorError } = await supabase
    .from("monitors")
    .select(
      "id, name, url, type, selector_css, interval_minutes, sensitivity, enabled, last_checked_at, last_change_at, last_status, created_at"
    )
    .eq("id", id)
    .maybeSingle<MonitorRecord>();

  if (monitorError) {
    throw new Error(monitorError.message);
  }

  if (!monitor) {
    notFound();
  }

  const latestChangeQuery = supabase
    .from("change_events")
    .select(
      `
        id,
        created_at,
        summary,
        severity,
        diff_blob,
        prev_snapshot:prev_snapshot_id (
          id,
          content_hash,
          text_normalized
        ),
        next_snapshot:next_snapshot_id (
          id,
          content_hash,
          text_normalized
        )
      `
    )
    .eq("monitor_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ChangeEventDetail>();

  const [changesResult, checksResult, latestChangeResult] = await Promise.all([
    supabase
      .from("changes")
      .select("id, created_at, summary, severity")
      .eq("monitor_id", id)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<ChangeRecord[]>(),
    supabase
      .from("checks")
      .select("id, started_at, status, http_status, error_message")
      .eq("monitor_id", id)
      .order("started_at", { ascending: false })
      .limit(8)
      .returns<CheckRecord[]>(),
    latestChangeQuery,
  ]);

  if (changesResult.error) {
    throw new Error(changesResult.error.message);
  }
  if (checksResult.error) {
    throw new Error(checksResult.error.message);
  }
  if (latestChangeResult.error) {
    throw new Error(latestChangeResult.error.message);
  }

  const changes = changesResult.data ?? [];
  const checks = checksResult.data ?? [];
  const timelineData = buildTimeline(changes);
  const totalRecentChanges = timelineData.reduce((sum, point) => sum + point.value, 0);
  const lastChange = changes[0] ?? null;
  const editableMonitor: EditableMonitor = {
    id: monitor.id,
    name: monitor.name,
    url: monitor.url,
    type: monitor.type === "section" ? "section" : "page",
    interval_minutes: monitor.interval_minutes,
    sensitivity: monitor.sensitivity,
    selector_css: monitor.selector_css,
  };
  const latestChange = latestChangeResult.data ?? null;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            ← Back to monitors
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--color-heading)]">{monitor.name}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            <span className="font-medium text-[var(--color-text-primary)]">{monitor.type.toUpperCase()}</span> ·{" "}
            <a
              href={monitor.url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-text-primary)] hover:text-[var(--color-brand-strong)] hover:underline"
            >
              {monitor.url}
            </a>
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 text-sm text-[var(--color-text-muted)] md:items-end">
          <MonitorActionsMenu monitorId={monitor.id} monitorName={monitor.name} enabled={monitor.enabled} />
          <div className="flex flex-col items-start gap-1 text-sm text-[var(--color-text-muted)] md:items-end">
            <StatusBadge status={monitor.last_status} />
            <p>Last checked {formatRelative(monitor.last_checked_at)}</p>
            <p>Interval • {describeInterval(monitor.interval_minutes)}</p>
            <p>{monitor.enabled ? "Monitoring" : "Paused"}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-4 shadow-sm">
          <p className="text-xs uppercase text-[var(--color-text-muted)]">Last change</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
            {lastChange ? formatRelative(lastChange.created_at) : "No changes yet"}
          </p>
          {lastChange && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {lastChange.summary ?? "Change detected"}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-4 shadow-sm">
          <p className="text-xs uppercase text-[var(--color-text-muted)]">Changes (14 days)</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{totalRecentChanges}</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{monitor.sensitivity} sensitivity</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-4 shadow-sm">
          <p className="text-xs uppercase text-[var(--color-text-muted)]">Selector / Mode</p>
          <p className="mt-2 text-sm text-[var(--color-text-primary)]">
            {monitor.type === "section"
              ? monitor.selector_css ?? "No selector provided"
              : "Whole page"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Created {formatDate(monitor.created_at)}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-heading)]">Monitor settings</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Edit the source, frequency, and sensitivity for this monitor.</p>
          </div>
        </div>
        <div className="mt-6">
          <MonitorSettingsForm monitor={editableMonitor} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-heading)]">Change cadence</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Change volume across the last two weeks</p>
            </div>
            <span className="text-sm text-[var(--color-text-muted)]">{monitor.url}</span>
          </div>
          <div className="mt-6">
            <ChangeTimelineChart data={timelineData} />
            {timelineData.every((point) => point.value === 0) && (
              <p className="mt-3 text-center text-sm text-[var(--color-text-muted)]">
                No changes detected in this window.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[var(--color-heading)]">Monitoring details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">URL</dt>
              <dd className="max-w-[220px] text-right text-[var(--color-text-primary)]">{monitor.url}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">Sensitivity</dt>
              <dd className="text-[var(--color-text-primary)] capitalize">{monitor.sensitivity}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">Interval</dt>
              <dd className="text-[var(--color-text-primary)]">{describeInterval(monitor.interval_minutes)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">Selector</dt>
              <dd className="max-w-[220px] text-right text-[var(--color-text-primary)]">
                {monitor.type === "section" ? monitor.selector_css ?? "—" : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">Started monitoring</dt>
              <dd className="text-[var(--color-text-primary)]">{formatDate(monitor.created_at)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--color-heading)]">Change history</h2>
            <span className="text-sm text-[var(--color-text-muted)]">Showing {changes.length} entries</span>
          </div>
          <div className="mt-4 space-y-4">
            {changes.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">No change events yet for this monitor.</p>
            )}
            {changes.map((change) => (
              <div key={change.id} className="rounded-xl border border-[var(--color-border-muted)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {change.summary ?? "Content updated"}
                  </p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severityBadge(change.severity)}`}>
                    {change.severity ?? "low"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatDate(change.created_at)}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[var(--color-heading)]">Recent checks</h2>
          {checks.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">No checks recorded yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="px-2 py-2">Started</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">HTTP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-muted)]">
                  {checks.map((check) => (
                    <tr key={check.id}>
                      <td className="px-2 py-3 text-[var(--color-text-muted)]">{formatDate(check.started_at)}</td>
                      <td className="px-2 py-3">
                        <StatusBadge status={check.status} />
                      </td>
                      <td className="px-2 py-3 text-[var(--color-text-muted)]">{check.http_status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-heading)]">Diff preview</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Latest change comparison using stored snapshots and normalized text excerpts.
            </p>
          </div>
          {latestChange && (
            <span className="text-sm text-[var(--color-text-muted)]">Captured {formatRelative(latestChange.created_at)}</span>
          )}
        </div>
        {latestChange ? (
          <DiffPreview change={latestChange} />
        ) : (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">
            No change diffs yet. Once a check detects a difference, you&apos;ll see the before/after snapshot text here.
          </p>
        )}
      </section>
    </div>
  );
}

function DiffPreview({ change }: { change: ChangeEventDetail }) {
  const diffBlob = change.diff_blob ?? null;
  const segmentDiff = isSegmentDiffBlob(diffBlob) ? diffBlob : null;
  const beforeText = extractSnapshotText(change.prev_snapshot, diffBlob, "before");
  const afterText = extractSnapshotText(change.next_snapshot, diffBlob, "after");
  const wordDeltaLabel = formatWordDelta(diffBlob);
  const diffTypeLabel = describeDiffType(diffBlob);
  const summary = change.summary ?? "Content updated";

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--color-text-primary)]">{summary}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{diffTypeLabel} · {wordDeltaLabel}</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${severityBadge(change.severity)}`}>
            {change.severity ?? "low"}
          </span>
        </div>
      </div>
      {segmentDiff ? (
        <>
          <SegmentDiffView diff={segmentDiff} />
          <SnapshotDetails beforeText={beforeText} afterText={afterText} />
        </>
      ) : (
        <FallbackDiffPanels beforeText={beforeText} afterText={afterText} />
      )}
    </div>
  );
}

function SegmentDiffView({ diff }: { diff: DiffBlob & { before_segments: DiffSegment[]; after_segments: DiffSegment[] } }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SegmentPanel
        label="Previous snippet"
        segments={diff.before_segments}
        truncatedPrefix={diff.truncated_prefix}
        truncatedSuffix={diff.truncated_suffix}
        emptyFallback="No snippet available from the previous run."
      />
      <SegmentPanel
        label="Latest snippet"
        segments={diff.after_segments}
        truncatedPrefix={diff.truncated_prefix}
        truncatedSuffix={diff.truncated_suffix}
        emptyFallback="No snippet captured for this run."
      />
    </div>
  );
}

function SegmentPanel({
  label,
  segments,
  truncatedPrefix,
  truncatedSuffix,
  emptyFallback,
}: {
  label: string;
  segments: DiffSegment[];
  truncatedPrefix?: boolean;
  truncatedSuffix?: boolean;
  emptyFallback: string;
}) {
  const hasSegments = Array.isArray(segments) && segments.length > 0;

  return (
    <div className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)] p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        <span>{label}</span>
        {!hasSegments && <span>—</span>}
      </div>
      {hasSegments ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
          {truncatedPrefix && <span className="text-[var(--color-text-muted)]">... </span>}
          {segments.map((segment, index) => (
            <span key={`${segment.kind}-${index}`} className={segmentClass(segment.kind)}>
              {index > 0 ? " " : ""}
              {segment.text}
            </span>
          ))}
          {truncatedSuffix && <span className="text-[var(--color-text-muted)]"> ...</span>}
        </p>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">{emptyFallback}</p>
      )}
    </div>
  );
}

function SnapshotDetails({ beforeText, afterText }: { beforeText: string | null; afterText: string | null }) {
  if (!beforeText && !afterText) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {beforeText && (
        <details className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)] p-4">
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            Full previous snapshot
          </summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
            {truncateText(beforeText, 2000)}
          </pre>
        </details>
      )}
      {afterText && (
        <details className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)] p-4">
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            Full latest snapshot
          </summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
            {truncateText(afterText, 2000)}
          </pre>
        </details>
      )}
    </div>
  );
}

function FallbackDiffPanels({ beforeText, afterText }: { beforeText: string | null; afterText: string | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <DiffPanel label="Previous snapshot" text={beforeText} fallback="No prior snapshot stored for this monitor." />
      <DiffPanel label="Latest snapshot" text={afterText} fallback="Snapshot text not available for this plan." />
    </div>
  );
}

function DiffPanel({ label, text, fallback }: { label: string; text: string | null; fallback: string }) {
  const displayText = text ? truncateText(text, 1200) : fallback;
  return (
    <div className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)] p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        <span>{label}</span>
        {text && <span className="font-mono text-[var(--color-text-muted)]">{text.length} chars</span>}
      </div>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
        {displayText}
      </pre>
    </div>
  );
}

function extractSnapshotText(
  snapshot: SnapshotDetail | null,
  diffBlob: DiffBlob | null,
  side: "before" | "after"
) {
  if (snapshot?.text_normalized) {
    return snapshot.text_normalized;
  }
  if (diffBlob && (diffBlob.type === "text_excerpt" || diffBlob.type === "text_segments")) {
    return side === "before" ? (diffBlob.before_excerpt as string | null) ?? null : (diffBlob.after_excerpt as string | null) ?? null;
  }
  return null;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

function formatWordDelta(diffBlob: DiffBlob | null) {
  if (!diffBlob || typeof diffBlob.word_delta !== "number" || Number.isNaN(diffBlob.word_delta)) {
    return "Delta unknown";
  }
  if (diffBlob.word_delta === 0) {
    return "No net change";
  }
  const sign = diffBlob.word_delta > 0 ? "+" : "";
  return `${sign}${diffBlob.word_delta} words`;
}

function describeDiffType(diffBlob: DiffBlob | null) {
  if (!diffBlob) {
    return "Unknown diff";
  }
  if (diffBlob.type === "text_segments") {
    return "Focused snippet";
  }
  if (diffBlob.type === "hash_only") {
    return "Hash comparison";
  }
  return "Text excerpt";
}

function isSegmentDiffBlob(diffBlob: DiffBlob | null): diffBlob is DiffBlob & {
  before_segments: DiffSegment[];
  after_segments: DiffSegment[];
} {
  return Boolean(
    diffBlob &&
      diffBlob.type === "text_segments" &&
      Array.isArray(diffBlob.before_segments) &&
      Array.isArray(diffBlob.after_segments)
  );
}

function segmentClass(kind: DiffSegment["kind"]) {
  switch (kind) {
    case "added":
      return "rounded-md bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[var(--color-success-ink)]";
    case "removed":
      return "rounded-md bg-[var(--color-danger-soft)] px-1.5 py-0.5 text-[var(--color-danger-ink)]";
    default:
      return "text-[var(--color-text-primary)]";
  }
}