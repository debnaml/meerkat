import "dotenv/config";
import { Pool } from "pg";
import { diffWords } from "diff";
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
      select u.*, m.url, m.type, m.selector_css, m.interval_minutes, m.sensitivity, o.plan_features
      from updated u
      join public.monitors m on m.id = u.monitor_id
      join public.orgs o on o.id = u.org_id;`, [limit]);
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
    const planFeatures = parsePlanFeatures(job.plan_features);
    const baseline = await runBaselineCheck({
        url: job.url,
        mode: job.type,
        selector: job.selector_css,
    });
    const nextCheckAt = addMinutes(baseline.fetchedAt, job.interval_minutes);
    const snapshotTier = typeof planFeatures.plan_tier === "string" ? planFeatures.plan_tier : null;
    const snapshotRetentionDays = getSnapshotRetentionDays(planFeatures);
    const snapshotExpiresAt = snapshotRetentionDays
        ? addDays(baseline.fetchedAt, snapshotRetentionDays)
        : null;
    const storeFullSnapshot = shouldStoreFullSnapshot(planFeatures);
    const normalizedText = storeFullSnapshot ? baseline.normalizedText : null;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const previousSnapshot = await loadLatestSnapshot(client, job.monitor_id);
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
        const checkId = checkResult.rows[0].id;
        const snapshotResult = await client.query(`insert into public.monitor_snapshots (
        monitor_id,
        check_id,
        tier,
        content_hash,
        html_path,
        text_normalized,
        blocks_json,
        expires_at
      ) values (
        $1, $2, $3, $4, null, $5, null, $6
      ) returning id`, [
            job.monitor_id,
            checkId,
            snapshotTier,
            baseline.contentHash,
            normalizedText,
            snapshotExpiresAt,
        ]);
        const snapshotId = snapshotResult.rows[0].id;
        await client.query(`update public.monitors
       set last_checked_at = $2,
           last_success_at = $2,
           last_status = 'ok',
           last_check_id = $3,
           next_check_at = $4
       where id = $1`, [job.monitor_id, baseline.fetchedAt, checkId, nextCheckAt]);
        if (previousSnapshot && previousSnapshot.content_hash !== baseline.contentHash) {
            await recordChangeEvent({
                client,
                job,
                previousSnapshot,
                nextSnapshotId: snapshotId,
                newCheckId: checkId,
                baselineText: normalizedText,
                fetchedAt: baseline.fetchedAt,
                contentHash: baseline.contentHash,
                planFeatures,
            });
        }
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
function addDays(iso, days) {
    const date = new Date(iso);
    if (Number.isNaN(date.valueOf())) {
        return null;
    }
    date.setDate(date.getDate() + days);
    return date.toISOString();
}
function truncateMessage(message, maxLength = 500) {
    return message.length <= maxLength ? message : `${message.slice(0, maxLength - 1)}...`;
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function parsePlanFeatures(raw) {
    if (!raw)
        return {};
    return raw;
}
function shouldStoreFullSnapshot(features) {
    if (typeof features.detailed_snapshots === "boolean") {
        return features.detailed_snapshots;
    }
    return true;
}
function shouldCaptureChangeBlocks(features) {
    return Boolean(features.semantic_diff);
}
function getSnapshotRetentionDays(features) {
    if (typeof features.snapshot_retention_days === "number" && Number.isFinite(features.snapshot_retention_days)) {
        return Math.max(1, Math.floor(features.snapshot_retention_days));
    }
    return features.semantic_diff ? 90 : 30;
}
async function loadLatestSnapshot(client, monitorId) {
    const { rows } = await client.query(`select id, check_id, content_hash, text_normalized
     from public.monitor_snapshots
     where monitor_id = $1
     order by created_at desc
     limit 1`, [monitorId]);
    return rows[0] ?? null;
}
async function recordChangeEvent(input) {
    const beforeText = input.previousSnapshot.text_normalized;
    const afterText = input.baselineText;
    const diffArtifacts = summarizeDiff(beforeText, afterText);
    const severity = mapSensitivityToSeverity(input.job.sensitivity);
    const diffBlobJson = JSON.stringify({
        before_hash: input.previousSnapshot.content_hash,
        after_hash: input.contentHash,
        ...diffArtifacts.diffBlob,
    });
    const changeEventResult = await input.client.query(`insert into public.change_events (
      monitor_id,
      prev_snapshot_id,
      next_snapshot_id,
      change_type,
      severity,
      summary,
      diff_blob
    ) values (
      $1, $2, $3, 'content', $4, $5, $6::jsonb
    ) returning id`, [
        input.job.monitor_id,
        input.previousSnapshot.id,
        input.nextSnapshotId,
        severity,
        diffArtifacts.summary,
        diffBlobJson,
    ]);
    const changeEventId = changeEventResult.rows[0]?.id ?? null;
    await input.client.query(`insert into public.changes (
      monitor_id,
      org_id,
      check_id_new,
      check_id_old,
      created_at,
      summary,
      severity
    ) values (
      $1, $2, $3, $4, $5, $6, $7
    )`, [
        input.job.monitor_id,
        input.job.org_id,
        input.newCheckId,
        input.previousSnapshot.check_id ?? null,
        input.fetchedAt,
        diffArtifacts.summary,
        severity,
    ]);
    await input.client.query(`update public.monitors
     set last_change_at = $2
     where id = $1`, [input.job.monitor_id, input.fetchedAt]);
    if (changeEventId && shouldCaptureChangeBlocks(input.planFeatures)) {
        await insertPrimaryChangeBlock({
            client: input.client,
            changeEventId,
            diffBlob: diffArtifacts.diffBlob,
            summary: diffArtifacts.summary,
        });
    }
}
function summarizeDiff(beforeText, afterText) {
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
    let summary;
    if (delta === 0) {
        summary = "Content updated";
    }
    else if (delta > 0) {
        summary = delta === 1 ? "1 word added" : `${delta} words added`;
    }
    else {
        const removed = Math.abs(delta);
        summary = removed === 1 ? "1 word removed" : `${removed} words removed`;
    }
    const segmentBlob = buildSegmentDiff(beforeText, afterText);
    const fallbackBlob = createExcerptBlob(beforeText, afterText);
    return {
        summary,
        diffBlob: {
            word_delta: delta,
            ...(segmentBlob ?? fallbackBlob),
        },
    };
}
function mapSensitivityToSeverity(sensitivity) {
    switch (sensitivity) {
        case "strict":
            return "high";
        case "relaxed":
            return "low";
        default:
            return "medium";
    }
}
function buildSegmentDiff(beforeText, afterText) {
    const normalizedChanges = normalizeChanges(diffWords(beforeText, afterText));
    if (normalizedChanges.length === 0) {
        return null;
    }
    const hasChange = normalizedChanges.some((change) => change.added || change.removed);
    if (!hasChange) {
        return null;
    }
    const window = selectChunkWindow(normalizedChanges);
    const segmentSets = buildSegmentsFromWindow(window.chunks);
    return {
        type: "text_segments",
        before_segments: segmentSets.beforeSegments,
        after_segments: segmentSets.afterSegments,
        before_excerpt: buildExcerpt(segmentSets.beforeSegments),
        after_excerpt: buildExcerpt(segmentSets.afterSegments),
        truncated_prefix: window.start > 0,
        truncated_suffix: window.end < normalizedChanges.length - 1,
    };
}
function createExcerptBlob(beforeText, afterText) {
    return {
        type: "text_excerpt",
        before_excerpt: beforeText.slice(0, 400),
        after_excerpt: afterText.slice(0, 400),
    };
}
function normalizeChanges(changes) {
    return changes
        .map((change) => {
        const normalized = change.value.replace(/\s+/g, " ").trim();
        return {
            ...change,
            value: normalized,
        };
    })
        .filter((change) => change.value.length > 0);
}
function selectChunkWindow(changes, maxChars = 480) {
    const changeIndices = changes
        .map((change, index) => ((change.added || change.removed) ? index : -1))
        .filter((index) => index >= 0);
    if (changeIndices.length === 0) {
        return {
            chunks: changes,
            start: 0,
            end: changes.length - 1,
        };
    }
    let start = changeIndices[0];
    let end = changeIndices[changeIndices.length - 1];
    let currentLength = sliceLength(changes, start, end);
    while (currentLength < maxChars && (start > 0 || end < changes.length - 1)) {
        const prevLength = start > 0 ? chunkLength(changes[start - 1]) : Number.POSITIVE_INFINITY;
        const nextLength = end < changes.length - 1 ? chunkLength(changes[end + 1]) : Number.POSITIVE_INFINITY;
        if (prevLength <= nextLength && start > 0) {
            start -= 1;
            currentLength += prevLength;
        }
        else if (end < changes.length - 1) {
            end += 1;
            currentLength += nextLength;
        }
        else {
            break;
        }
    }
    return {
        chunks: changes.slice(start, end + 1),
        start,
        end,
    };
}
function buildSegmentsFromWindow(changes) {
    const beforeSegments = [];
    const afterSegments = [];
    changes.forEach((change) => {
        const text = change.value;
        if (!text) {
            return;
        }
        if (change.added) {
            afterSegments.push({ kind: "added", text });
        }
        else if (change.removed) {
            beforeSegments.push({ kind: "removed", text });
        }
        else {
            const segment = { kind: "context", text };
            beforeSegments.push(segment);
            afterSegments.push(segment);
        }
    });
    return { beforeSegments, afterSegments };
}
function buildExcerpt(segments, maxLength = 600) {
    const combined = segments.map((segment) => segment.text).join(" ").trim();
    if (!combined) {
        return null;
    }
    if (combined.length <= maxLength) {
        return combined;
    }
    return `${combined.slice(0, maxLength)}...`;
}
function chunkLength(change) {
    return change.value.length;
}
function sliceLength(changes, start, end) {
    let total = 0;
    for (let index = start; index <= end; index += 1) {
        total += chunkLength(changes[index]);
    }
    return total;
}
async function insertPrimaryChangeBlock(params) {
    if (!isSegmentDiffBlobPayload(params.diffBlob)) {
        return;
    }
    const action = determineBlockAction(params.diffBlob);
    const excerpt = params.diffBlob.after_excerpt ?? params.diffBlob.before_excerpt ?? params.summary;
    const title = buildBlockTitle(params.summary, excerpt);
    const metadata = {
        truncated_prefix: params.diffBlob.truncated_prefix,
        truncated_suffix: params.diffBlob.truncated_suffix,
        word_delta: params.diffBlob.word_delta ?? null,
    };
    await params.client.query(`insert into public.change_blocks (
      change_event_id,
      block_key,
      action,
      title,
      text_excerpt,
      metadata
    ) values (
      $1, $2, $3, $4, $5, $6::jsonb
    )`, [
        params.changeEventId,
        "primary",
        action,
        title,
        excerpt ? truncateToLength(excerpt, 600) : null,
        JSON.stringify(metadata),
    ]);
}
function isSegmentDiffBlobPayload(blob) {
    return Boolean(blob &&
        blob.type === "text_segments" &&
        Array.isArray(blob.before_segments) &&
        Array.isArray(blob.after_segments));
}
function determineBlockAction(blob) {
    const hasBefore = blob.before_segments?.some((segment) => segment.kind !== "context");
    const hasAfter = blob.after_segments?.some((segment) => segment.kind !== "context");
    if (!hasBefore && hasAfter) {
        return "added";
    }
    if (hasBefore && !hasAfter) {
        return "removed";
    }
    if (typeof blob.word_delta === "number") {
        if (blob.word_delta > 0)
            return "added";
        if (blob.word_delta < 0)
            return "removed";
    }
    return "modified";
}
function buildBlockTitle(summary, excerpt) {
    if (summary && summary !== "Content updated") {
        return truncateToLength(summary, 120);
    }
    if (excerpt) {
        const firstSentence = excerpt.split(/(?<=[.!?])\s+/)[0] ?? excerpt;
        return truncateToLength(firstSentence, 120);
    }
    return "Content updated";
}
function truncateToLength(value, maxLength) {
    if (!value) {
        return null;
    }
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength)}...`;
}
main().catch((error) => {
    console.error("[worker] Fatal error", error);
    process.exitCode = 1;
});
