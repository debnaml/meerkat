import Link from "next/link";

import { getLatestMonitors } from "@/lib/queries/monitors";

const features = [
  {
    title: "Page + section monitors",
    detail:
      "Track entire documents or scoped selectors with our normalization pipeline and hashed diffs.",
  },
  {
    title: "Change intelligence",
    detail:
      "Generate readable diffs, store HTML snapshots, and surface summaries for fast triage.",
  },
  {
    title: "Reliable alerts",
    detail:
      "Email first, then Slack/webhooks. Quiet hours and digests are planned right after MVP.",
  },
  {
    title: "Polite crawling",
    detail:
      "Playwright only when needed, rotating user agents, and per-domain throttles baked in.",
  },
];

const milestones = [
  {
    label: "Foundations",
    body: "Auth, org model, Stripe plan metadata, and baseline Playwright smoke tests.",
  },
  {
    label: "Monitor engine",
    body: "Scheduler + worker pipeline that stores checks, compares hashes, and emits ChangeDetected events.",
  },
  {
    label: "Diff UX",
    body: "Dashboard, section picker, diff viewer, and notification tuning in the Next.js app.",
  },
  {
    label: "Operational hardening",
    body: "Observability, retention jobs, rate limiting, and on-call runbooks before GA.",
  },
];

const qaSignals = [
  {
    title: "Playwright regression",
    detail: "Headless journeys for signup → monitor → alert block deploys if they fail.",
  },
  {
    title: "Fixture pages",
    detail: "Pricing, status, and regulatory fixtures emit deterministic diffs for normalization tests.",
  },
  {
    title: "Metrics",
    detail: "Checks/hour, success rate, and change latency are exported via OpenTelemetry.",
  },
];

const relativeDateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : relativeDateFormatter.format(date);
}

function formatUrlHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    console.error("Invalid monitor URL", error);
    return url;
  }
}

export default async function Home() {
  const monitors = await getLatestMonitors().catch((error) => {
    console.error("Failed to load monitors", error);
    return [];
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16">
        <section className="rounded-3xl bg-slate-900 px-8 py-12 text-white shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
            Change monitoring
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
            Meet Meerkat — a trustworthy ChangeTower-style SaaS.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-200">
            Configure page or section monitors, capture normalized text + snapshots, and notify teams within
            minutes. Built with Next.js, BullMQ workers, and Playwright-backed fallbacks.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-slate-200">
            <span className="rounded-full border border-white/20 px-4 py-1">
              15m → daily frequencies
            </span>
            <span className="rounded-full border border-white/20 px-4 py-1">
              Multi-tenant + Stripe plans
            </span>
            <span className="rounded-full border border-white/20 px-4 py-1">
              Email alerts today, Slack next
            </span>
          </div>
          <div className="mt-10 flex flex-wrap gap-3 text-sm">
            <Link
              href="/signup"
              className="rounded-full bg-white px-6 py-2 font-semibold text-slate-900 shadow-sm"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/30 px-6 py-2 font-semibold text-white"
            >
              Log in
            </Link>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">What ships first</h2>
              <p className="text-sm text-slate-500">
                Directly pulled from spec.md → spec2.md so engineering and product stay aligned.
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              MVP in sight
            </span>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{feature.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">Delivery milestones</h2>
            <ol className="mt-6 space-y-4">
              {milestones.map((item, index) => (
                <li key={item.label} className="flex gap-4">
                  <span className="mt-1 h-8 w-8 shrink-0 rounded-full bg-slate-100 text-center text-sm font-semibold leading-8 text-slate-700">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{item.label}</p>
                    <p className="text-sm text-slate-600">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">QA & ops guardrails</h2>
            <div className="mt-6 space-y-4">
              {qaSignals.map((signal) => (
                <article key={signal.title} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">{signal.title}</p>
                  <p className="text-sm text-slate-600">{signal.detail}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-xs uppercase tracking-[0.2em] text-slate-400">
              Playwright · Supabase · BullMQ · OpenTelemetry
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Latest monitors (Supabase)</h2>
              <p className="text-sm text-slate-500">
                Server-rendered directly from your linked database using the Supabase service client.
              </p>
            </div>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-900">
              Live data
            </span>
          </div>

          {monitors.length ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {monitors.map((monitor) => (
                <article key={monitor.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{monitor.name}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {monitor.type} · every {monitor.interval_minutes}m
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white">
                      {monitor.last_status ?? "pending"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600" title={monitor.url}>
                    {formatUrlHost(monitor.url)}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>
                      <dt className="font-semibold text-slate-700">Last checked</dt>
                      <dd className="mt-1 text-slate-900">{formatTimestamp(monitor.last_checked_at)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-700">Last change</dt>
                      <dd className="mt-1 text-slate-900">{formatTimestamp(monitor.last_change_at)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">No monitors yet</p>
              <p className="mt-2">
                Insert a row into the `monitors` table for your dev org (`DEV_ORG_ID`) via Supabase SQL or the
                table editor, then refresh this page to see live data.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
