"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MONITOR_INTERVALS } from "@/lib/monitors/constants";

interface MonitorRowActionsProps {
  id: string;
  enabled: boolean;
  interval: number;
}

export function MonitorRowActions({ id, enabled, interval }: MonitorRowActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function updateMonitor(patch: Record<string, unknown>) {
    setPending(true);
    await fetch(`/api/monitors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    router.refresh();
    setPending(false);
  }

  async function deleteMonitor() {
    setPending(true);
    await fetch(`/api/monitors/${id}`, { method: "DELETE" });
    router.refresh();
    setPending(false);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={interval}
        disabled={pending}
        className="rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] px-2 py-1 text-xs text-[var(--color-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]"
        onChange={(event) =>
          updateMonitor({ interval_minutes: Number(event.target.value) })
        }
      >
        {MONITOR_INTERVALS.map((value) => (
          <option value={value} key={value}>
            {value}m
          </option>
        ))}
      </select>
      <Button
        type="button"
        onClick={() => updateMonitor({ enabled: !enabled })}
        disabled={pending}
        variant={enabled ? "successSubtle" : "subtle"}
        className="rounded-full px-3 py-1 text-xs font-semibold"
      >
        {enabled ? "Enabled" : "Paused"}
      </Button>
      <Button
        type="button"
        onClick={deleteMonitor}
        disabled={pending}
        variant="dangerOutline"
        className="rounded-full px-3 py-1 text-xs font-semibold"
      >
        Remove
      </Button>
    </div>
  );
}
