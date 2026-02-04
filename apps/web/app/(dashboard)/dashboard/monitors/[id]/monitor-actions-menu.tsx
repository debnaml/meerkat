"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

interface MonitorActionsMenuProps {
  monitorId: string;
  monitorName: string;
  enabled: boolean;
}

type MonitorAction = "run" | "pause" | "resume" | "stop";

export function MonitorActionsMenu({ monitorId, monitorName, enabled }: MonitorActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<MonitorAction | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open, closeMenu]);

  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, closeMenu]);

  function toggleMenu() {
    setOpen((previous) => !previous);
  }

  async function handleAction(action: MonitorAction) {
    if (pendingAction) return;

    if (action === "stop") {
      const confirmed = window.confirm(`Stop monitoring "${monitorName}"? This cannot be undone.`);
      if (!confirmed) {
        return;
      }
    }

    setPendingAction(action);

    try {
      let response: Response;

      switch (action) {
        case "run":
          response = await fetch(`/api/monitors/${monitorId}/run`, { method: "POST" });
          break;
        case "pause":
          response = await fetch(`/api/monitors/${monitorId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: false }),
          });
          break;
        case "resume":
          response = await fetch(`/api/monitors/${monitorId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: true }),
          });
          break;
        case "stop":
          response = await fetch(`/api/monitors/${monitorId}`, { method: "DELETE" });
          break;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = typeof data.error === "string" ? data.error : "Action failed";
        throw new Error(message);
      }

      closeMenu();
      if (action === "stop") {
        router.push("/dashboard");
        return;
      }
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      window.alert(message);
    } finally {
      setPendingAction(null);
    }
  }

  const pauseLabel = enabled ? "Pause monitoring" : "Resume monitoring";
  const pauseAction: MonitorAction = enabled ? "pause" : "resume";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-surface-muted)]",
          open && "bg-[var(--color-surface-muted)]"
        )}
      >
        Actions
        <span className={cn("text-[var(--color-text-muted)] transition-transform", open && "rotate-180")}>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] p-2 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction("run")}
            disabled={pendingAction !== null}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-60"
          >
            <span>{pendingAction === "run" ? "Running…" : "Run check now"}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction(pauseAction)}
            disabled={pendingAction !== null}
            className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-60"
          >
            <span>
              {pendingAction === pauseAction ? (enabled ? "Pausing…" : "Resuming…") : pauseLabel}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction("stop")}
            disabled={pendingAction !== null}
            className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--color-danger-ink)] transition-colors hover:bg-[var(--color-danger-soft)] disabled:opacity-60"
          >
            <span>{pendingAction === "stop" ? "Stopping…" : "Stop monitoring"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
