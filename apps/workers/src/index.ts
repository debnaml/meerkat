import "dotenv/config";
import { Pool, PoolClient } from "pg";

import { runBaselineCheck } from "../../web/lib/monitors/baseline-check";
import type { MonitorMode } from "../../web/lib/monitors/constants";

interface PendingJob {
  id: string;
  monitor_id: string;
  org_id: string;
  scheduled_for: string;
  attempts: number;
  locked_at: string | null;
  lock_id: string | null;
  error_message: string | null;
  url: string;
  type: MonitorMode;
  selector_css: string | null;
  interval_minutes: number;
  sensitivity: string;
  plan_features: Record<string, unknown> | null;
}

interface SnapshotSummary {
  id: string;
  check_id: string;
  content_hash: string | null;
  text_normalized: string | null;
}

interface PlanFeatures {
  detailed_snapshots?: boolean;
  semantic_diff?: boolean;
}

const DATABASE_URL = process.env.DATABASE_URL;
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? "5");
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? "5000");
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS ?? "5");

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the worker");
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const watchMode = process.argv.includes("--watch");

  if (watchMode) {
    console.log("[worker] Starting continuous polling loop");
    while (true) {
      const processed = await processBatch();
      if (processed === 0) {
        await delay(POLL_INTERVAL_MS);
      }
    }
  } else {
    const processed = await processBatch();
    console.log(`[worker] Processed ${processed} jobs`);
    await pool.end();
  }
}

async function processBatch(limit = BATCH_SIZE) {
  const jobs = await claimPendingJobs(limit);
  if (jobs.length === 0) {
    return 0;
  }

  let successCount = 0;
  for (const job of jobs) {
    const start = Date.now();
    try {
      await handleJob(job);
      successCount += 1;
      const durationMs = Date.now() - start;
      console.log(
        `[worker] Monitor ${job.monitor_id} processed in ${durationMs}ms (attempt ${job.attempts + 1})`
      );
    } catch (error) {
      console.error(`[worker] Failed monitor ${job.monitor_id}`, error);
      await markJobFailed(job, error as Error);
    }
  }

  return successCount;
}

async function claimPendingJobs(limit: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<PendingJob>(
      `with candidates as (
        select pc.id
        from public.pending_checks pc
        where pc.locked_at is null
          and pc.scheduled_for <= now()
        order by pc.scheduled_for asc
        limit $1
        for update skip locked
      ), updated as (
        update public.pending_checks pc
        set locked_at = now(),
            lock_id = gen_random_uuid()
        where pc.id in (select id from candidates)
        returning pc.*
      )
      select u.*, m.url, m.type, m.selector_css, m.interval_minutes, m.sensitivity, o.plan_features
      from updated u
      join public.monitors m on m.id = u.monitor_id
      join public.orgs o on o.id = u.org_id;`,
      [limit]
    );
    await client.query("COMMIT");
    return rows;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[worker] Failed to claim jobs", error);
    return [];
  } finally {
    client.release();
  }
}

async function handleJob(job: PendingJob) {
  const planFeatures = parsePlanFeatures(job.plan_features);
  const baseline = await runBaselineCheck({
    url: job.url,
    mode: job.type,
    selector: job.selector_css,
  });

  const nextCheckAt = addMinutes(baseline.fetchedAt, job.interval_minutes);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const previousSnapshot = await loadLatestSnapshot(client, job.monitor_id);
    const checkResult = await client.query<{ id: string }>(
      `insert into public.checks (
        monitor_id,
        org_id,
        started_at,
        finished_at,
        status,
        http_status,
        content_hash,
        extracted_text_bytes,
        html_bytes,
        final_url,
        error_message
      ) values (
        $1, $2, $3, $4, 'ok', $5, $6, $7, $8, $9, null
      ) returning id`,
      [
        job.monitor_id,
        job.org_id,
        baseline.fetchedAt,
        baseline.fetchedAt,
        baseline.httpStatus,
        baseline.contentHash,
        baseline.textBytes,
        baseline.htmlBytes,
        baseline.finalUrl,
      ]
    );
    const checkId = checkResult.rows[0].id;

    const snapshotResult = await client.query<{ id: string }>(
      `insert into public.monitor_snapshots (
        monitor_id,
        check_id,
        tier,
        content_hash,
        html_path,
        text_normalized,
        blocks_json,
        expires_at
      ) values (
        $1, $2, $3, $4, null, $5, null, null
      ) returning id`,
      [
        job.monitor_id,
        checkId,
        null,
        baseline.contentHash,
        shouldStoreFullSnapshot(planFeatures) ? baseline.normalizedText : null,
      ]
    );
    const snapshotId = snapshotResult.rows[0].id;

    await client.query(
      `update public.monitors
       set last_checked_at = $2,
           last_success_at = $2,
           last_status = 'ok',
           last_check_id = $3,
           next_check_at = $4
       where id = $1`,
      [job.monitor_id, baseline.fetchedAt, checkId, nextCheckAt]
    );

    if (previousSnapshot && previousSnapshot.content_hash !== baseline.contentHash) {
      await recordChangeEvent({
        client,
        job,
        previousSnapshot,
        nextSnapshotId: snapshotId,
        newCheckId: checkId,
        baselineText: shouldStoreFullSnapshot(planFeatures) ? baseline.normalizedText : null,
        fetchedAt: baseline.fetchedAt,
        contentHash: baseline.contentHash,
      });
    }

    await client.query(`delete from public.pending_checks where id = $1`, [job.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function markJobFailed(job: PendingJob, error: Error) {
  const attempts = job.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await pool.query(
      `update public.pending_checks
       set attempts = $2,
           error_message = $3,
           locked_at = null,
           lock_id = null
       where id = $1`,
      [job.id, attempts, truncateMessage(error.message)]
    );
    console.warn(`[worker] Job ${job.id} reached max attempts. Manual review required.`);
    return;
  }

  const retryDelayMinutes = Math.min(60, attempts * 5);
  await pool.query(
    `update public.pending_checks
     set attempts = $2,
         error_message = $3,
         locked_at = null,
         lock_id = null,
         scheduled_for = now() + ($4 || ' minutes')::interval
     where id = $1`,
    [job.id, attempts, truncateMessage(error.message), retryDelayMinutes]
  );
}

function addMinutes(iso: string, minutes: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function truncateMessage(message: string, maxLength = 500) {
  return message.length <= maxLength ? message : `${message.slice(0, maxLength - 1)}…`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePlanFeatures(raw: Record<string, unknown> | null): PlanFeatures {
  if (!raw) return {};
  return raw as PlanFeatures;
}

function shouldStoreFullSnapshot(features: PlanFeatures) {
  if (typeof features.detailed_snapshots === "boolean") {
    return features.detailed_snapshots;
  }
  return true;
}

async function loadLatestSnapshot(client: PoolClient, monitorId: string): Promise<SnapshotSummary | null> {
  const { rows } = await client.query<SnapshotSummary>(
    `select id, check_id, content_hash, text_normalized
     from public.monitor_snapshots
     where monitor_id = $1
     order by created_at desc
     limit 1`,
    [monitorId]
  );
  return rows[0] ?? null;
}

interface RecordChangeEventInput {
  client: PoolClient;
  job: PendingJob;
  previousSnapshot: SnapshotSummary;
  nextSnapshotId: string;
  newCheckId: string;
  baselineText: string | null;
  fetchedAt: string;
  contentHash: string;
}

async function recordChangeEvent(input: RecordChangeEventInput) {
  const beforeText = input.previousSnapshot.text_normalized;
  const afterText = input.baselineText;
  const diffArtifacts = summarizeDiff(beforeText, afterText);
  const severity = mapSensitivityToSeverity(input.job.sensitivity);
  const diffBlobJson = JSON.stringify({
    before_hash: input.previousSnapshot.content_hash,
    after_hash: input.contentHash,
    ...diffArtifacts.diffBlob,
  });

  await input.client.query(
    `insert into public.change_events (
      monitor_id,
      prev_snapshot_id,
      next_snapshot_id,
      change_type,
      severity,
      summary,
      diff_blob
    ) values (
      $1, $2, $3, 'content', $4, $5, $6::jsonb
    )`,
    [
      input.job.monitor_id,
      input.previousSnapshot.id,
      input.nextSnapshotId,
      severity,
      diffArtifacts.summary,
      diffBlobJson,
    ]
  );

  await input.client.query(
    `insert into public.changes (
      monitor_id,
      org_id,
      check_id_new,
      check_id_old,
      created_at,
      summary,
      severity
    ) values (
      $1, $2, $3, $4, $5, $6, $7
    )`,
    [
      input.job.monitor_id,
      input.job.org_id,
      input.newCheckId,
      input.previousSnapshot.check_id ?? null,
      input.fetchedAt,
      diffArtifacts.summary,
      severity,
    ]
  );

  await input.client.query(
    `update public.monitors
     set last_change_at = $2
     where id = $1`,
    [input.job.monitor_id, input.fetchedAt]
  );
}

function summarizeDiff(beforeText: string | null, afterText: string | null) {
  if (!beforeText || !afterText) {
    return {
      summary: "Content updated",
      diffBlob: {
        type: "hash_only",
      },
    };
  }

  const beforeWords = beforeText.split(/\s+/).filter(Boolean);
  const afterWords = afterText.split(/\s+/).filter(Boolean);
  const delta = afterWords.length - beforeWords.length;

  let summary: string;
  if (delta === 0) {
    summary = "Content updated";
  } else if (delta > 0) {
    summary = delta === 1 ? "1 word added" : `${delta} words added`;
  } else {
    const removed = Math.abs(delta);
    summary = removed === 1 ? "1 word removed" : `${removed} words removed`;
  }

  return {
    summary,
    diffBlob: {
      type: "text_excerpt",
      word_delta: delta,
      before_excerpt: beforeText.slice(0, 400),
      after_excerpt: afterText.slice(0, 400),
    },
  };
}

function mapSensitivityToSeverity(sensitivity: string | null) {
  switch (sensitivity) {
    case "strict":
      return "high";
    case "relaxed":
      return "low";
    default:
      return "medium";
  }
}

main().catch((error) => {
  console.error("[worker] Fatal error", error);
  process.exitCode = 1;
});
