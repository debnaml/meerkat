import "dotenv/config";
import { Pool } from "pg";
import { runBaselineCheck } from "../../web/lib/monitors/baseline-check";
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
    }
    else {
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
            console.log(`[worker] Monitor ${job.monitor_id} processed in ${durationMs}ms (attempt ${job.attempts + 1})`);
        }
        catch (error) {
            console.error(`[worker] Failed monitor ${job.monitor_id}`, error);
            await markJobFailed(job, error);
        }
    }
    return successCount;
}
async function claimPendingJobs(limit) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query(`with candidates as (
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
      select u.*, m.url, m.type, m.selector_css, m.interval_minutes, m.sensitivity
      from updated u
      join public.monitors m on m.id = u.monitor_id;`, [limit]);
        await client.query("COMMIT");
        return rows;
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("[worker] Failed to claim jobs", error);
        return [];
    }
    finally {
        client.release();
    }
}
async function handleJob(job) {
    const baseline = await runBaselineCheck({
        url: job.url,
        mode: job.type,
        selector: job.selector_css,
    });
    const nextCheckAt = addMinutes(baseline.fetchedAt, job.interval_minutes);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const checkResult = await client.query(`insert into public.checks (
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
      ) returning id`, [
            job.monitor_id,
            job.org_id,
            baseline.fetchedAt,
            baseline.fetchedAt,
            baseline.httpStatus,
            baseline.contentHash,
            baseline.textBytes,
            baseline.htmlBytes,
            baseline.finalUrl,
        ]);
        await client.query(`update public.monitors
       set last_checked_at = $2,
           last_success_at = $2,
           last_status = 'ok',
           last_check_id = $3,
           next_check_at = $4
       where id = $1`, [job.monitor_id, baseline.fetchedAt, checkResult.rows[0].id, nextCheckAt]);
        await client.query(`delete from public.pending_checks where id = $1`, [job.id]);
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
async function markJobFailed(job, error) {
    const attempts = job.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
        await pool.query(`update public.pending_checks
       set attempts = $2,
           error_message = $3,
           locked_at = null,
           lock_id = null
       where id = $1`, [job.id, attempts, truncateMessage(error.message)]);
        console.warn(`[worker] Job ${job.id} reached max attempts. Manual review required.`);
        return;
    }
    const retryDelayMinutes = Math.min(60, attempts * 5);
    await pool.query(`update public.pending_checks
     set attempts = $2,
         error_message = $3,
         locked_at = null,
         lock_id = null,
         scheduled_for = now() + ($4 || ' minutes')::interval
     where id = $1`, [job.id, attempts, truncateMessage(error.message), retryDelayMinutes]);
}
function addMinutes(iso, minutes) {
    const date = new Date(iso);
    if (Number.isNaN(date.valueOf())) {
        return null;
    }
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
}
function truncateMessage(message, maxLength = 500) {
    return message.length <= maxLength ? message : `${message.slice(0, maxLength - 1)}…`;
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
main().catch((error) => {
    console.error("[worker] Fatal error", error);
    process.exitCode = 1;
});
