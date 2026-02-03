import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-20">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Meerkat</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Change monitoring HQ</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage monitors, alerts, and plans.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
