import Link from "next/link";

import { QuickAddModal } from "./quick-add-modal";
import { StatusBadge } from "@/components/status-badge";
import { describeInterval } from "@/lib/formatters";
import { getServerComponentClient } from "@/lib/supabase/server-clients";

interface ChangeRecord {
  id: string;
  monitor_id: string;
  created_at: string;
  summary: string | null;
  severity: "low" | "medium" | "high" | null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString();
}

function formatUrlLabel(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return `${parsed.hostname}${path}`;
  } catch {
    return url;
  }
}

function sensitivityBadgeClasses(value: string | null) {
  switch (value) {
    case "strict":
      return "bg-[var(--color-danger-soft)] text-[var(--color-danger-ink)]";
    case "relaxed":
      return "bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)]";
    default:
      return "bg-[var(--color-warning-soft)] text-[var(--color-warning-ink)]";
  }
}

export default async function DashboardPage() {
  const supabase = await getServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const [{ data: monitors }, { data: recentChanges }] = await Promise.all([
    supabase
      .from("monitors")
      .select(
        "id, name, url, type, interval_minutes, sensitivity, enabled, last_status, last_checked_at, last_change_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("changes")
      .select("id, monitor_id, created_at, summary, severity")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<ChangeRecord[]>(),
  ]);

  const monitorList = monitors ?? [];
  const recentChangeList = recentChanges ?? [];

  const totalMonitors = monitorList.length;
  const pausedMonitors = monitorList.filter((monitor) => monitor.enabled === false).length;
  const failingMonitors = monitorList.filter((monitor) => monitor.last_status && monitor.last_status !== "ok").length;
  const healthyMonitors = Math.max(totalMonitors - failingMonitors - pausedMonitors, 0);
  const recentChangeCount = recentChangeList.length;

  const now = Date.now();
  const attentionMonitors =
    monitorList.filter((monitor) => {
      if (monitor.enabled === false) return true;
      if (monitor.last_status && monitor.last_status !== "ok") return true;
      if (!monitor.last_checked_at) return true;
      const lastCheck = new Date(monitor.last_checked_at).valueOf();
      if (Number.isNaN(lastCheck)) return false;
      const intervalMs = (monitor.interval_minutes || 5) * 60 * 1000;
      return lastCheck + intervalMs * 3 < now;
    }) ?? [];

  const monitorLookup = new Map(monitorList.map((monitor) => [monitor.id, monitor]));

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Dashboard</p>
          <h1 className="text-3xl font-semibold text-[var(--color-heading)]">Monitor overview</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Track live status, recent changes, and upcoming work.</p>
        </div>
        <Link
          href="/"
          className="text-sm text-[var(--color-text-muted)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline"
        >
          View marketing site
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-4">
          <p className="text-xs uppercase text-[var(--color-text-muted)]">Monitors</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-heading)]">{totalMonitors}</p>
          <p className="text-sm text-[var(--color-text-muted)]">{healthyMonitors} healthy · {pausedMonitors} paused</p>
        </article>
        <article className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-4">
          <p className="text-xs uppercase text-[var(--color-text-muted)]">Needs attention</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-heading)]">{failingMonitors}</p>
          <p className="text-sm text-[var(--color-text-muted)]">Status not ok or stale</p>
        </article>
        <article className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-4">
          <p className="text-xs uppercase text-[var(--color-text-muted)]">Recent changes</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-heading)]">{recentChangeCount}</p>
          <p className="text-sm text-[var(--color-text-muted)]">Last 8 recorded events</p>
        </article>
        <article className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-4">
          <p className="text-xs uppercase text-[var(--color-text-muted)]">Last change</p>
          <p className="mt-2 text-xl font-semibold text-[var(--color-heading)]">
            {recentChangeList[0] ? formatDate(recentChangeList[0].created_at) : "No changes yet"}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">Across all monitors</p>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-heading)]">Active monitors</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{totalMonitors} total</p>
          </div>
          <QuickAddModal />
        </div>
        {monitorList.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="px-2 py-2">Monitor</th>
                  <th className="px-2 py-2">Mode</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Interval</th>
                  <th className="px-2 py-2">Last checked</th>
                  <th className="px-2 py-2">Last change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-muted)]">
                {monitorList.map((monitor) => (
                  <tr key={monitor.id} className="text-[var(--color-text-primary)]">
                    <td className="px-2 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/monitors/${monitor.id}`}
                          className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-muted)]"
                        >
                          {monitor.name}
                        </Link>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sensitivityBadgeClasses(
                            monitor.sensitivity
                          )}`}
                        >
                          {monitor.sensitivity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]" title={monitor.url}>
                        {formatUrlLabel(monitor.url)}
                      </p>
                    </td>
                    <td className="px-2 py-4 text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
                      {monitor.type}
                    </td>
                    <td className="px-2 py-4 text-xs text-[var(--color-text-muted)]">
                      <StatusBadge status={monitor.last_status} />
                    </td>
                    <td className="px-2 py-4 text-xs text-[var(--color-text-muted)]">
                      {describeInterval(monitor.interval_minutes)}
                    </td>
                    <td className="px-2 py-4 text-xs text-[var(--color-text-muted)]">
                      {formatDate(monitor.last_checked_at)}
                    </td>
                    <td className="px-2 py-4 text-xs text-[var(--color-text-muted)]">
                      {formatDate(monitor.last_change_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border-muted)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-muted)]">
            No monitors yet. Use the quick add card to create your first watch.
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[var(--color-heading)]">Needs attention</h2>
          {attentionMonitors.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">All monitors look healthy.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {attentionMonitors.slice(0, 5).map((monitor) => (
                <li key={monitor.id} className="rounded-xl border border-[var(--color-border-muted)] p-3">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/dashboard/monitors/${monitor.id}`}
                      className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-muted)]"
                    >
                      {monitor.name}
                    </Link>
                    <StatusBadge status={monitor.last_status} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Last check {formatDate(monitor.last_checked_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--color-heading)]">Recent changes</h2>
            <span className="text-sm text-[var(--color-text-muted)]">Last {recentChangeCount}</span>
          </div>
          {recentChangeList.length > 0 ? (
            <div className="mt-4 space-y-3 text-sm">
              {recentChangeList.map((change) => {
                const monitor = monitorLookup.get(change.monitor_id);
                return (
                  <div key={change.id} className="rounded-xl border border-[var(--color-border-muted)] p-3">
                    <p className="font-semibold text-[var(--color-text-primary)]">{change.summary ?? "Content updated"}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDate(change.created_at)}</p>
                    {monitor && (
                      <Link
                        href={`/dashboard/monitors/${monitor.id}`}
                        className="mt-1 inline-block text-xs text-[var(--color-text-primary)] hover:text-[var(--color-text-muted)]"
                      >
                        {monitor.name}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">No change events recorded yet.</p>
          )}
        </article>
      </section>
    </div>
  );
}
