# Change Events & Snapshots (Week 3)

This note captures the schema extensions needed to compare snapshots, generate change events, and lay the groundwork for premium semantic summaries.

## Goals

1. Persist raw HTML and normalized text for selected monitors so we can rerun diff logic or AI summarization later.
2. Emit explicit `change_events` rows instead of inferring change state from `monitors.last_change_at`.
3. Keep CPU/storage costs bounded by gating heavy artifacts on plan tier and enforcing retention.
4. Provide a clean interface for the dashboard and future notification jobs to consume change history.

## Data Model

### `monitor_snapshots`

| Column            | Type                              | Notes                                                  |
| ----------------- | --------------------------------- | ------------------------------------------------------ |
| `id`              | uuid pk default gen_random_uuid() | Primary key                                            |
| `monitor_id`      | uuid references monitors(id)      | Required                                               |
| `check_id`        | uuid references checks(id) unique | Ties snapshot to the originating check                 |
| `tier`            | text                              | Captures plan at capture time                          |
| `content_hash`    | text                              | Hash of normalized text (used to detect repeats)       |
| `html_path`       | text                              | Object storage path for raw HTML (null if not stored)  |
| `text_normalized` | text                              | Cleaned text used for diffing (nullable for low tiers) |
| `blocks_json`     | jsonb                             | Optional block segmentation payload                    |
| `created_at`      | timestamptz default now()         | Audit                                                  |
| `expires_at`      | timestamptz                       | Retention cutoff; nightly job prunes past this         |

Indexes:

- `(monitor_id, created_at desc)` for UI access
- `(content_hash)` for dedupe/skip logic
- Partial index on `expires_at` for vacuum job

### `change_events`

| Column             | Type                                  | Notes                                          |
| ------------------ | ------------------------------------- | ---------------------------------------------- |
| `id`               | uuid pk default gen_random_uuid()     | Primary key                                    |
| `monitor_id`       | uuid references monitors(id)          | Required                                       |
| `prev_snapshot_id` | uuid references monitor_snapshots(id) | Nullable when baseline only                    |
| `next_snapshot_id` | uuid references monitor_snapshots(id) | Required                                       |
| `change_type`      | text                                  | e.g., `content`, `blocked`, `selector_missing` |
| `severity`         | text                                  | `low`/`medium`/`high`                          |
| `summary`          | text                                  | Human-readable headline                        |
| `diff_blob`        | jsonb                                 | Structured diff payload (added/removed blocks) |
| `notified_at`      | timestamptz                           | When an alert was sent                         |
| `created_at`       | timestamptz default now()             | Audit                                          |

Indexes:

- `(monitor_id, created_at desc)` for dashboard feed
- `coalesce(notified_at)` partial index for notification jobs

### `change_blocks` (premium-only)

| Column            | Type                              | Notes                                                |
| ----------------- | --------------------------------- | ---------------------------------------------------- |
| `id`              | uuid pk                           |                                                      |
| `change_event_id` | uuid references change_events(id) | Required                                             |
| `block_key`       | text                              | Stable identifier (e.g., CSS selector hash)          |
| `action`          | text                              | `added`, `removed`, `modified`                       |
| `title`           | text                              | Block heading (e.g., job title)                      |
| `text_excerpt`    | text                              | Snippet for summaries                                |
| `metadata`        | jsonb                             | Arbitrary structured fields (salary, location, etc.) |

This table is populated only when the monitor’s org has semantic insights enabled.

## Worker Flow Impact

1. After each successful check, determine whether the org/monitor tier requires snapshot capture.
2. If yes, persist `monitor_snapshots` with normalized text, object-storage path to HTML, block segmentation, and retention date.
3. Compare the latest snapshot hash to the prior snapshot for that monitor. If hashes differ (or the plan forces full comparison), compute a diff, create a `change_events` row, and optionally store block-level entries.
4. Update `monitors.last_change_at` with `change_events.created_at` and keep `last_status` logic unchanged.
5. Notification workers (Week 4) will query `change_events` where `notified_at is null` instead of inspecting `checks` directly.

## Tier Gating & Retention

- Add a `plan_features` JSONB column on `orgs` (or use existing billing metadata) that flags `detailed_snapshots` and `semantic_diff`.
- Worker only writes `html_path`/`text_normalized` when `detailed_snapshots` is true.
- `change_blocks` rows only exist when `semantic_diff` is true.
- Each snapshot row stores `expires_at = created_at + interval '<tier-specific>'`. A nightly task deletes rows past expiry and cascades orphaned change events if needed.

## API & UI Hooks

- Dashboard “Recent changes” will switch to reading from `change_events`, showing `summary`, `severity`, and linking to a new detail view.
- Monitor detail page gains a Change History list backed by `change_events` + `change_blocks` once UI work lands.
- Future `/api/changes/:id` route can return the diff blob, block metadata, and raw snapshot references for exporting or AI summaries.

With these tables in place, Week 3 implementation can proceed incrementally: ship migrations, adjust the worker to populate snapshots/events for opted-in monitors, then layer on the UI. Premium semantic summaries remain a toggle we can enable later without another schema overhaul.
