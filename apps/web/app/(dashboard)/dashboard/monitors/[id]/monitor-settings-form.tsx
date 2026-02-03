"use client";

import { useRouter } from "next/navigation";

import { MonitorForm, type MonitorFormValues } from "@/components/monitor-form";

export interface EditableMonitor {
  id: string;
  name: string;
  url: string;
  type: "page" | "section";
  interval_minutes: MonitorFormValues["interval_minutes"];
  sensitivity: MonitorFormValues["sensitivity"];
  selector_css: string | null;
}

interface MonitorSettingsFormProps {
  monitor: EditableMonitor;
}

export function MonitorSettingsForm({ monitor }: MonitorSettingsFormProps) {
  const router = useRouter();

  async function handleSubmit(values: MonitorFormValues) {
    const res = await fetch(`/api/monitors/${monitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Failed to update monitor");
    }

    router.refresh();
  }

  return (
    <MonitorForm
      initialValues={{
        name: monitor.name,
        url: monitor.url,
        interval_minutes: monitor.interval_minutes,
        sensitivity: monitor.sensitivity,
        type: monitor.type,
        selector_css: monitor.selector_css,
      }}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      successMessage="Monitor updated"
      onSubmit={handleSubmit}
    />
  );
}
