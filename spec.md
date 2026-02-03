# Page & Section Monitoring SaaS Spec (ChangeTower-style)
Version: 0.1  
Authors: Nova (product, UX), Dave (engineering)  
Timezone: Europe/London

## 0. Goals
Build a SaaS that monitors web pages and specific page sections for changes, notifies users via email (and later Slack, webhook), and provides a dashboard for managing monitors, alerts, and history.

Must support:
- Page monitoring (whole page)
- Section monitoring (CSS selector, XPath, or visual region)
- Multiple clients (multi-tenant)
- Self-serve signup, billing, and monitor management
- Change history (diff, snapshots)
- Schedules (5 min to daily)
- Alerts to email (MVP), then Slack/webhook
- Team accounts (Phase 2)

Non-goals for MVP:
- Full web scraping marketplace, public API, or massive crawl discovery
- Monitoring behind authentication
- Mobile app

Success metric (MVP):
- A customer can sign up, add monitors, see change history, and receive reliable alerts within 15 minutes of changes.

---

## 1. Users & Use Cases
### Primary user types
1. Solo user (consultant, recruiter, analyst)
2. Small team (2 to 20)
3. Agency running monitors for multiple clients (Phase 2 feature, separate orgs)

### Key use cases
- Track careers pages for new listings
- Track pricing pages for changes
- Track product availability, status pages
- Track specific page section (job list container)
- Track competitor landing pages and announcements
- Monitor regulatory pages for updates

---

## 2. Core Concepts
### Monitor
A configured watcher for a URL plus a detection mode.

Monitor types:
- Whole Page: detect meaningful content change for the entire page
- Section: detect changes within a defined subset of the DOM
- Visual: detect changes within a screenshot region (optional in MVP, recommended as Phase 2)

### Check
A scheduled fetch of a monitor that produces:
- Raw HTML
- Cleaned text representation
- Optional screenshot
- Hashes and extracted content
- Status (success, error, blocked, timeout)

### Change Event
Created when a check differs materially from the previous successful check.

### Notification
A delivery record for a change event:
- email sent status
- retry status
- bounce tracking (later)

---

## 3. MVP Feature List
### Account & Auth
- Email/password signup and login
- Email verification
- Password reset
- Basic profile settings
- Tenant separation (each org has its own monitors and billing)

### Dashboard
- Monitor list with status, last check, next check, and last change
- Create monitor flow
- Monitor detail page showing:
  - last successful snapshot
  - change history list
  - diff view for changes
  - check logs and errors

### Monitor Creation
Inputs:
- URL
- Monitor name
- Check frequency (15m, 1h, 6h, 12h, daily) for MVP
- Mode: Whole page or Section
- Section definition:
  - CSS selector (MVP)
  - Advanced: XPath (Phase 2)
- Change sensitivity:
  - Strict (any diff)
  - Normal (ignore whitespace and minor markup changes)
  - Relaxed (ignore boilerplate and small edits)
- Notification rules:
  - email recipients (default: account email)
  - notify on: change only, errors only, both
  - quiet hours (Phase 2)

### Section Picker UX (MVP)
- Load page preview in an embedded browser frame or headless render
- Allow user to click an element and auto-generate CSS selector
- Show a highlighted overlay of selected section
- “Test selection” button previews extracted text and screenshot snippet

### Change Detection & Diff
- HTML normalization:
  - remove scripts, styles
  - remove known noisy elements (nav, footer) optionally
- Extract text for hashing and diff
- Store previous normalized text
- When changed, generate:
  - text diff (unified diff)
  - optional visual diff (Phase 2)

### Notifications
- Email notifications:
  - summary of what changed
  - link to dashboard diff
- Digest mode (daily summary) optional in MVP, recommended
- Per-monitor notification toggle

### Pricing, Plans, Limits
Plan-based constraints:
- Max monitors (pages)
- Min check frequency
- Retention (days of history)

MVP billing:
- Stripe subscription with 2 to 3 tiers
- Seat-based is Phase 2

---

## 4. Phase 2 Feature List
- Slack notifications (OAuth install)
- Webhooks (POST payload on change)
- Visual monitoring (region-based screenshot diff)
- XPath selectors
- Regex filters to only alert when certain text appears
- “Ignore” rules (remove elements by selector)
- Change approval workflow for teams
- Monitor sharing and roles (Owner, Admin, Member)
- Public status pages for monitors (optional)
- Authenticated page monitoring with stored cookies (security heavy)
- API for creating and managing monitors

---

## 5. System Architecture (Dave)
### High-level
- Web app (frontend)
- API backend
- Worker system for scheduled checks
- Database for tenants, monitors, checks, diffs, notifications
- Object storage for HTML snapshots and screenshots
- Queue for jobs (checks, notifications)

### Recommended stack (aligns with your existing comfort)
Frontend:
- Next.js (App Router)
- Tailwind CSS
- shadcn/ui components
- Recharts for simple charts

Backend:
- Node.js (Fastify or Next.js API routes to start)
- Worker: Node + BullMQ (Redis) or Cloud Tasks equivalent

Database:
- Postgres (Supabase recommended)
- Row Level Security for multi-tenant isolation

Storage:
- Supabase Storage or S3 compatible for:
  - HTML snapshots (gzipped)
  - screenshots (png/webp)
  - diff artifacts

Queue:
- Upstash Redis (cheap) or managed Redis
- BullMQ for scheduling and retries

Scheduling:
- A scheduler service that enqueues checks per monitor on intervals
- Alternatively, Postgres-based scheduling plus a “tick” worker

Email:
- SendGrid or Postmark

Browser rendering:
- Playwright for JS-heavy sites
- Use only when needed due to cost
- For most pages use plain HTTP fetch + HTML parse

### Important constraints
- Polite crawling: rate limits per domain, retry with backoff
- User-Agent rotation, but keep it honest and consistent
- Respect robots.txt optionally as a product stance (configurable)

---

## 6. Data Model (Postgres)
### Tables
#### orgs
- id (uuid, pk)
- name (text)
- created_at (timestamptz)

#### users
- id (uuid, pk)
- org_id (uuid, fk orgs.id)
- email (text, unique per org or globally unique)
- password_hash (text) or Supabase Auth reference
- role (text: owner, admin, member)
- created_at

#### plans
- id (text pk) like "starter", "pro"
- max_monitors (int)
- min_interval_minutes (int)
- retention_days (int)
- price_id_stripe (text)

#### subscriptions
- id (uuid pk)
- org_id (uuid fk)
- plan_id (text fk)
- stripe_customer_id (text)
- stripe_subscription_id (text)
- status (text)
- current_period_end (timestamptz)

#### monitors
- id (uuid pk)
- org_id (uuid fk)
- name (text)
- url (text)
- type (text: page, section, visual)
- selector_css (text nullable)
- interval_minutes (int)
- sensitivity (text: strict, normal, relaxed)
- enabled (bool)
- last_checked_at (timestamptz nullable)
- last_success_at (timestamptz nullable)
- last_change_at (timestamptz nullable)
- last_status (text: ok, error, blocked)
- created_at

#### checks
- id (uuid pk)
- monitor_id (uuid fk)
- org_id (uuid fk, denormalized for RLS queries)
- started_at (timestamptz)
- finished_at (timestamptz)
- status (text: ok, timeout, http_error, blocked, parse_error)
- http_status (int nullable)
- fetch_mode (text: http, playwright)
- content_hash (text)
- extracted_text_bytes (int)
- html_snapshot_path (text nullable)
- screenshot_path (text nullable)
- error_message (text nullable)

#### changes
- id (uuid pk)
- monitor_id (uuid fk)
- org_id (uuid fk)
- check_id_new (uuid fk checks.id)
- check_id_old (uuid fk checks.id)
- created_at (timestamptz)
- diff_path (text nullable)
- summary (text nullable)
- severity (text: low, medium, high) optional

#### notifications
- id (uuid pk)
- org_id (uuid fk)
- change_id (uuid fk)
- channel (text: email, slack, webhook)
- target (text: email address or webhook url id)
- status (text: pending, sent, failed)
- sent_at (timestamptz nullable)
- error_message (text nullable)

#### monitor_recipients (MVP optional, else inline array)
- id (uuid pk)
- monitor_id (uuid fk)
- email (text)

### Indexes
- monitors(org_id, enabled)
- checks(monitor_id, started_at desc)
- changes(monitor_id, created_at desc)
- notifications(change_id)

---

## 7. Change Detection Strategy
### Normalization pipeline (MVP)
Input: HTML
Steps:
1. Parse DOM
2. Remove <script>, <style>, noscript
3. Remove hidden elements (display:none)
4. If section mode:
   - querySelectorAll(selector_css)
   - take first match by default
   - optionally allow multiple matches and join
5. Extract textContent
6. Collapse whitespace
7. Optional boilerplate removal for relaxed sensitivity:
   - remove common nav/footer by heuristics
   - or allow user-defined ignore selectors in Phase 2
8. Compute hash (sha256 of normalized text)

Change detection rule:
- If previous successful check exists:
  - if hash differs, create change event
- Else:
  - treat as baseline, no change event

Diff generation:
- Store both normalized texts
- Generate unified diff
- Save diff artifact to storage

### Visual monitoring (Phase 2)
- Take screenshot each check
- Compute perceptual hash (pHash)
- If differs beyond threshold, create change event
- Optional visual diff overlay image

---

## 8. Worker & Scheduling Design (Dave)
### Components
1. Scheduler
- Runs every minute
- Finds monitors due for check:
  - enabled = true
  - now >= last_checked_at + interval
- Enqueues jobs into queue

2. Checker worker
For each job:
- Fetch page via HTTP
- If response indicates heavy JS or extraction fails repeatedly:
  - fallback to Playwright for that monitor
- Normalize, hash, store snapshot, create check record
- Compare to previous successful check hash
- If changed, create change record
- Enqueue notification jobs

3. Notification worker
- Sends emails
- Retries with exponential backoff
- Writes notification status

### Rate limiting
- Per-domain concurrency cap (example: max 2 concurrent checks per domain)
- Global concurrency cap per worker (example: 10)

### Retry policy
- Timeouts and transient errors retry up to 3 times
- If blocked (403 with bot challenge), mark monitor last_status = blocked and notify user optionally

---

## 9. Product Design Spec (Nova)
### Brand
- Clean, modern, “reliability” vibe
- Minimal color palette, one accent color
- High contrast status indicators
- Typography: Inter

### UI layout
- Left sidebar navigation:
  - Dashboard
  - Monitors
  - Alerts
  - Settings
  - Billing
- Top bar:
  - Org name switcher (Phase 2)
  - Search monitors
  - User menu

### Key screens
#### 9.1 Dashboard
Widgets:
- Monitors total
- Changes in last 7 days
- Errors in last 24 hours
- Recent changes feed (table)

Recent changes table columns:
- Monitor
- URL
- Detected at
- Type (page/section)
- Status (change/error)
- Action: View diff

#### 9.2 Monitors List
Table columns:
- Name
- URL (domain + truncated path)
- Type
- Interval
- Last checked
- Last change
- Status badge
- Toggle enabled
Row click opens monitor detail

Bulk actions:
- Enable/disable
- Delete (confirm)
- Change interval (plan-limited)

#### 9.3 Create Monitor Flow
Step 1: Basics
- URL input with validation
- Name auto-filled from domain
- Interval dropdown (based on plan)
- Type toggle: Page or Section

Step 2: Section selection (if Section)
- Embedded preview
- Click to select element
- Shows generated selector
- “Test selection” shows extracted text preview and highlighted region

Step 3: Notifications
- Send to my email (default)
- Add recipients (optional)
- Notify on: change only, errors only, both
- Save monitor

Success state:
- “First check will run within X minutes”
- Button: View monitor

#### 9.4 Monitor Detail
Header:
- Name, URL, enabled toggle
- Status, last check time, next check countdown
Tabs:
- Changes (default)
- Checks
- Settings

Changes tab:
- Timeline list of change events
- Selecting one shows diff view:
  - left: previous
  - right: current
  - changed lines highlighted
- Option to “mark as expected” (Phase 2)

Checks tab:
- list of checks with status and latency
- error logs

Settings tab:
- interval
- sensitivity
- selector
- notification recipients

#### 9.5 Alerts Screen
- All notifications with status
- Filter by: change, error, monitor
- Retry failed (admin only)

#### 9.6 Settings
- Profile
- Org
- Security (2FA later)
- Email preferences

#### 9.7 Billing
- Plan card
- Usage meter (monitors used, checks per month)
- Upgrade/downgrade
- Payment method

### Visual Components
Badges:
- OK (green)
- Changed (blue)
- Error (red)
- Blocked (amber)

Diff viewer:
- Monospace
- Line numbers
- Copy diff button

Empty states:
- Friendly and instructive
- “Add your first monitor” CTA

---

## 10. Security & Compliance
- Multi-tenant isolation enforced by RLS
- Rate limiting on API endpoints
- Validate URLs to prevent SSRF:
  - block localhost and private IP ranges
  - block file:// and other schemes
  - allow only http and https
- Store minimal personal data
- Audit logs for key actions (Phase 2)

---

## 11. Plan Enforcement (Critical)
Plan limits must be enforced in API:
- monitor creation blocked when above max_monitors
- interval choices restricted by plan min_interval_minutes
- retention_days used to prune old checks and snapshots

Retention job:
- nightly cleanup deletes checks and snapshots beyond retention_days

---

## 12. Observability
- Structured logs from workers
- Metrics:
  - checks per hour
  - success rate
  - average fetch latency
  - top failing domains
- Admin dashboard (Phase 2) or simple internal page

---

## 13. Performance & Cost Controls
- Default fetch via HTTP
- Only use Playwright when:
  - selector returns empty on 3 consecutive HTTP checks
  - or user manually toggles “JS rendering required”
- Compress HTML snapshots (gzip)
- Do not store full HTML indefinitely on low tiers
- Store normalized text in DB for diff and hashing
- Store full HTML and screenshots in object storage with retention

---

## 14. API Endpoints (MVP)
Auth:
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/reset-password

Monitors:
- GET /api/monitors
- POST /api/monitors
- GET /api/monitors/:id
- PATCH /api/monitors/:id
- DELETE /api/monitors/:id
- POST /api/monitors/:id/test-selector

Checks:
- GET /api/monitors/:id/checks

Changes:
- GET /api/monitors/:id/changes
- GET /api/changes/:id/diff

Billing:
- POST /api/billing/checkout-session
- POST /api/billing/portal

---

## 15. Implementation Plan
### Milestone 1: Foundations (Week 1)
- Next.js app skeleton, auth, org model
- Monitor CRUD UI basic

### Milestone 2: Workers & Checks (Week 2)
- Scheduler and queue
- HTTP fetch checks
- Normalization and hashing
- Store checks

### Milestone 3: Change Events & Diff (Week 3)
- Compare baseline, generate change events
- Diff artifact generation and viewer UI

### Milestone 4: Notifications (Week 4)
- Email notifications
- Notification history UI
- Error handling, retries

### Milestone 5: Section Picker (Week 5)
- Embedded preview
- Click-to-select element, CSS selector generation
- Test selector feature

### Milestone 6: Billing & Limits (Week 6)
- Stripe subscriptions
- Stripe plan setup stub
- Plan enforcement
- Retention cleanup jobs

---

## 16. Open Questions
1. Visual monitoring in MVP or Phase 2?
2. Robots.txt stance: respect always, optional, or ignore?
3. Do we allow monitoring pages behind bot protection and captchas?
4. Minimum check interval for paid tiers: 5 min, 10 min, 15 min?
5. Do we support multiple recipients in MVP?

---

## 17. Acceptance Criteria (MVP)
- User can sign up and create a page monitor in under 2 minutes
- User can create a section monitor by selecting an element visually
- System checks monitors on schedule with 95%+ success rate for normal sites
- When a change occurs, user receives an email within 15 minutes
- Dashboard shows change history and a readable diff for each change
- Plan limits prevent abuse and control costs

---

## 18. Appendix: CSS Selector Generation Notes
Selector strategy:
- Prefer stable attributes: id, data-* attributes
- Then class names
- Avoid nth-child unless necessary
- Provide user ability to edit selector in settings
- On save, validate selector returns a match

Test selector should return:
- number of matches
- extracted text length
- screenshot preview of selected bounding box (Phase 2 if heavy)

---

## 19. Appendix: Error States
Common errors:
- DNS failure
- Timeout
- HTTP 403/429
- Cloudflare challenge
- Selector not found
- JS-only content

User-facing messaging:
- “This site may block automated checks. Try switching to JS rendering.” (if supported)
- “Your selector no longer matches the page. Re-pick the section.”

---

## 20. Design References
- ChangeTower, Visualping, Distill for patterns
- Linear for clean UI and tables
- Vercel dashboard for layout clarity

End of spec.