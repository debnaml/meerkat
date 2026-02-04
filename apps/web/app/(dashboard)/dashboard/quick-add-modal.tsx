"use client";

import { useEffect, useState } from "react";

import { CreateMonitorForm } from "./create-monitor-form";

export function QuickAddModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("keydown", handleKey);
    }
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--color-border-muted)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] shadow-sm transition hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]"
      >
        + Add
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Quick add</p>
                <h2 className="text-2xl font-semibold text-[var(--color-heading)]">Create a monitor</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Fill in the details to start monitoring immediately.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-transparent p-2 text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-6">
              <CreateMonitorForm />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
