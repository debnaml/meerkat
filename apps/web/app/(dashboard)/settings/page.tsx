import { ThemePreferenceForm } from "@/components/settings/theme-preference-form";
import { formatDate } from "@/lib/formatters";
import { getServerComponentClient } from "@/lib/supabase/server-clients";

export default async function SettingsPage() {
  const supabase = await getServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const user = session.user;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-heading)]">Profile & Preferences</h1>
          <p className="text-sm text-[var(--color-text-muted)]">View your account details and manage workspace settings.</p>
        </div>
        <dl className="mt-6 grid gap-6 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Account email</dt>
            <dd className="mt-1 text-base font-medium text-[var(--color-text-primary)]">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">User ID</dt>
            <dd className="mt-1 break-all text-[var(--color-text-primary)]">{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Joined</dt>
            <dd className="mt-1 text-[var(--color-text-primary)]">{formatDate(user.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Last active</dt>
            <dd className="mt-1 text-[var(--color-text-primary)]">{formatDate(user.last_sign_in_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-[var(--color-heading)]">Theme</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Choose how Meerkat should look across monitors, charts, and settings.</p>
        </div>
        <div className="mt-6">
          <ThemePreferenceForm />
        </div>
      </section>
    </div>
  );
}
