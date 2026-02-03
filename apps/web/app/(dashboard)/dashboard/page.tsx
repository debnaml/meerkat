import Link from "next/link";

import { CreateMonitorForm } from "./create-monitor-form";
import { MonitorRowActions } from "./monitor-row-actions";
import { getServerComponentClient } from "@/lib/supabase/server-clients";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString();
}

export default async function DashboardPage() {
  const supabase = await getServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const { data: monitors } = await supabase
    .from("monitors")
    .select(
      "id, name, url, type, interval_minutes, sensitivity, enabled, last_status, last_checked_at, last_change_at"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-heading)]">Monitors</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Create and manage page/section monitors for your org.</p>
          </div>
          <Link
            href="/"
            className="text-sm text-[var(--color-text-muted)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline"
          >
            View marketing site
          </Link>
        </div>
        <div className="mt-6">
          <CreateMonitorForm />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-[var(--color-heading)]">Active monitors</h2>
        {monitors && monitors.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">URL</th>
                  <th className="px-2 py-2">Mode</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Last checked</th>
                  <th className="px-2 py-2">Last change</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-muted)]">
                {monitors.map((monitor) => (
                  <tr key={monitor.id} className="text-[var(--color-text-primary)]">
                    <td className="px-2 py-3">
                      <Link
                        href={`/dashboard/monitors/${monitor.id}`}
                        className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-muted)]"
                      >
                        {monitor.name}
                      </Link>
                      <p className="text-xs text-[var(--color-text-muted)]">{monitor.sensitivity} sensitivity</p>
                    </td>
                    <td className="px-2 py-3 text-xs text-[var(--color-text-muted)]" title={monitor.url}>
                      {new URL(monitor.url).hostname}
                    </td>
                    <td className="px-2 py-3 text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
                      {monitor.type}
                    </td>
                    <td className="px-2 py-3 text-xs text-[var(--color-text-muted)]">
                      {monitor.last_status ?? "pending"}
                    </td>
                    <td className="px-2 py-3 text-xs text-[var(--color-text-muted)]">
                      {formatDate(monitor.last_checked_at)}
                    </td>
                    <td className="px-2 py-3 text-xs text-[var(--color-text-muted)]">
                      {formatDate(monitor.last_change_at)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <MonitorRowActions
                        id={monitor.id}
                        enabled={monitor.enabled ?? true}
                        interval={monitor.interval_minutes}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border-muted)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-muted)]">
            No monitors yet. Use the form above to add your first page or section watch.
          </div>
        )}
      </section>
    </div>
  );
}
