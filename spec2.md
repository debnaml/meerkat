# Meerkat Product Spec v0.2 (Working Draft)

Version: 0.2  
Authors: Nova (product, UX), Dave (engineering), GitHub Copilot (support)  
Timezone: Europe/London  
Last updated: 2026-02-02

## Purpose

- Extend the v0.1 spec in [spec.md](spec.md) with concrete decisions, testing requirements, and a living to-do list to guide implementation.
- Highlight opinionated design patterns so the architecture stays simple, maintainable, and testable as scope expands.
- Bake end-to-end testing (Playwright) and monitoring into every milestone to keep change detection trustworthy.

## Key Enhancements vs v0.1

1. **Product differentiation**: Add "Assurance Layer" (automated diff QA, trust signals) to stand out from ChangeTower-style competitors.
2. **Design-system commitments**: Lock in a component and typography strategy with semantic tokens to speed UI delivery.
3. **Testing-first build**: Treat Playwright suites and contract tests as gatekeepers; every milestone includes acceptance specs plus fixtures.
4. **Operational guardrails**: Document observability SLIs/SLOs and rate-limit policies before coding crawlers.
5. **Delivery workflow**: Introduce dual-track backlog (Product+Engineering) with definition of ready/done, ensuring to-do items remain actionable.

## Architectural & Design Patterns

- **Domain modules**: auth, billing, monitors, checks, notifications modeled as separate service modules following hexagonal architecture (ports/adapters) inside a single repo to start.
- **Command handlers + background jobs**: UI/API issue commands; workers react via BullMQ queues so side effects are isolated and testable.
- **Event log**: Upon change detection, persist domain events (ChangeDetected, NotificationSent) for replayability and analytics hooks.
- **Config-driven crawlers**: Per-monitor policy object describing fetch mode, politeness, retries; enables deterministic tests.
- **UI composition**: Next.js server components for data-heavy pages, client components only for interactive elements (section picker, diff viewer).

## Testing & QA Strategy

- **Playwright**: baseline suites for signup, monitor CRUD, change notification flow; run headless in CI plus nightly full regression.
- **Contract tests**: Pact-style tests between API and worker queue payloads to avoid schema drift.
- **Fixture pages**: Host internal test pages (Pricing, Status, Regulatory) with deterministic change scripts to validate diff accuracy end-to-end.
- **Performance tests**: k6 or Artillery smoke to ensure scheduler + worker throughput for 10x expected MVP load.
- **Alerting on tests**: If Playwright regression fails in main, block deploy; send Slack alert to internal channel (pre-Slack customer feature).

## Experience & UI Notes

- Adopt a deliberate visual language (e.g., Suisse Intl + IBM Plex Mono for diffs) to avoid generic dashboards; keep accent color configurable per org later.
- Section picker uses floating inspector with breadcrumbs to confirm hierarchy, preventing accidental wrapper selections.
- Include "trust badges" on dashboard (uptime %, monitors healthy) derived from worker metrics to reinforce reliability story.

## Updated Milestones (Each includes Playwright coverage & acceptance demos)

1. **Foundations**: Auth + org + baseline Playwright signup/login suite.
2. **Monitor CRUD + Section Picker alpha**: Must ship picker smoke tests (desktop + mobile viewports) and fixture-page diffs.
3. **Check pipeline + Change events**: Include replay harness that can re-run normalization on stored HTML to catch regressions.
4. **Notifications & Digest**: Add email snapshot tests (MJML + screenshot) and Playwright coverage for notification preferences.
5. **Billing & Limits**: Simulate plan edge cases via integration tests; ensure retention cron respects plan configs.
6. **Operational Hardening**: Load tests, chaos exercises for worker retries, on-call runbooks.

## To-Do Backlog (Living List)

### Product Discovery

- [ ] Rank the first three page categories to support (e.g., pricing, status, regulatory) and define success metrics for each.
- [ ] Build and maintain a corpus of 50 representative public URLs (mixed industries) to use as deterministic fixtures and demo data.
- [ ] Decide robots.txt stance (respect/optional/ignore) and message it in onboarding.
- [ ] Define minimum viable visual monitoring story (Phase 2) and success metrics.

### Design System

- [ ] Finalize typography pairing (sans + mono) and semantic color tokens (background, surface, brand, critical, warning, success).
- [ ] Produce diff viewer spec (interactions, copy, accessible colors) with redlines.
- [ ] Prototype section picker micro-interactions (hover outlines, selection confirmation, undo) in Figma.

### Engineering Foundations

- [ ] Scaffold Next.js App Router project with shared `packages/domain`, `packages/ui`, `apps/web`, `apps/workers` structure.
- [ ] Implement Supabase schema migrations + RLS policies matching [spec.md](spec.md).
- [ ] Configure BullMQ workers with per-domain concurrency tokens; add integration tests around scheduling fairness.
- [ ] Create configuration module for monitor policies (fetch mode, politeness) using typed schema validation (Zod).

### Monitoring & Detection

- [ ] Build normalization pipeline module with pluggable transformers (scripts/styles removal, selector focus, boilerplate filters).
- [ ] Add deterministic hashing tests using fixture HTML to verify strict/normal/relaxed sensitivity outputs.
- [ ] Implement diff artifact generator (text + optional visual placeholder) and storage uploader.
- [ ] Design ChangeDetected event schema and persist for audit/log replay.

### Notifications & Billing

- [ ] Implement email templating with MJML + inlined CSS; add screenshot regression tests.
- [ ] Integrate Postmark (or SendGrid) with retry + bounce webhooks.
- [ ] Wire Stripe billing (Checkout + Customer Portal) with webhook handler tests in Playwright via test clock.
- [ ] Enforce plan limits in API (monitors, frequency, retention) with unit + e2e coverage.

### Testing & Observability

- [ ] Stand up Playwright test harness with fixtures, seeded Supabase, and CI workflow (GitHub Actions).
- [ ] Record user journey videos from Playwright for marketing/QA artifacts.
- [ ] Instrument workers with OpenTelemetry traces and metrics (checks/hour, change rate, error domains) feeding into Grafana or Vercel Observability.
- [ ] Define SLIs/SLOs (e.g., 95% of checks succeed within 3 minutes of schedule) and add alert thresholds.
- [ ] Add synthetic monitors in staging for each core page category; failures block deploys until resolved.

### Tooling & Ops

- [ ] Create developer CLI (`meerkat dev`) for running web, worker, scheduler locally with shared env config.
- [ ] Document runbooks for crawler blocks (403, captchas) and escalation steps.
- [ ] Implement feature flag system (LaunchDarkly or simple DB-driven) for phased rollouts (e.g., Playwright fallback, digest emails).

### Open Questions (track + resolve)

- [ ] Minimum paid-tier interval? Need pricing research + infra cost modeling.
- [ ] Multi-recipient support at launch? Clarify email deliverability cost + UI complexity.
- [ ] Policy on authenticated pages? Explore secure cookie vault vs deferring to Phase 2.
- [ ] Should we expose user-facing changelog of monitors (public status pages)?

## Acceptance & Definition of Done Updates

- Every user-facing story must include:
  - Playwright coverage (desktop + mobile where relevant).
  - Accessibility check (axe-core) for new UI components.
  - Observability hooks (logs + metrics) with dashboards updated.
  - Rollback plan documented in PR description.
- Release is shippable only when regression suite, linting, and type checks are green on main.

## Next Steps

- Confirm open questions priority order.
- Stand up mono-repo structure and baseline CI with Playwright + lint/test.
- Stand up sample monitors across pricing/status/regulatory fixtures and feed their results into the Playwright regression + metrics dashboards.
