"use client";

import { useRouter } from "next/navigation";

import { MonitorForm, type MonitorFormValues } from "@/components/monitor-form";

export function CreateMonitorForm() {
  const router = useRouter();

  async function handleSubmit(values: MonitorFormValues) {
    const res = await fetch("/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Failed to create monitor");
    }

    router.refresh();
  }

  return (
    <MonitorForm
      initialValues={{
        name: "",
        url: "",
        type: "page",
        interval_minutes: 60,
        sensitivity: "normal",
        selector_css: null,
      }}
      submitLabel="Create monitor"
      pendingLabel="Creating…"
      onSubmit={handleSubmit}
      resetOnSuccess
      fullWidthButton
    />
  );
}
