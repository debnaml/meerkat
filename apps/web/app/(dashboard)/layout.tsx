import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/dashboard-nav";
import { UserMenu } from "@/components/user-menu";
import { getServerComponentClient } from "@/lib/supabase/server-clients";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await getServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const email = session.user.email ?? "";

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)]">
      <header className="border-b border-[var(--color-border-muted)] bg-[color-mix(in_oklab,var(--color-surface-card)_90%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/dashboard" className="text-base font-semibold text-[var(--color-heading)]">
              Meerkat Workspace
            </Link>
            <p className="text-sm text-[var(--color-text-muted)]">Track page and section changes in one place.</p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <DashboardNav />
            <UserMenu email={email} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
