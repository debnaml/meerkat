"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MONITOR_INTERVAL_OPTIONS,
  MONITOR_INTERVALS,
  MONITOR_SENSITIVITY_OPTIONS,
  type MonitorMode,
  type MonitorSensitivity,
} from "@/lib/monitors/constants";

export interface MonitorFormValues {
  name: string;
  url: string;
  interval_minutes: (typeof MONITOR_INTERVALS)[number];
  sensitivity: MonitorSensitivity;
  type: MonitorMode;
  selector_css: string | null;
}

interface MonitorFormProps {
  initialValues: MonitorFormValues;
  submitLabel: string;
  pendingLabel?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  onSubmit: (values: MonitorFormValues) => Promise<void>;
  fullWidthButton?: boolean;
}

export function MonitorForm({
  initialValues,
  submitLabel,
  pendingLabel = "Saving…",
  successMessage,
  resetOnSuccess = false,
  onSubmit,
  fullWidthButton = false,
}: MonitorFormProps) {
  const [mode, setMode] = useState<MonitorMode>(initialValues.type);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(formElement);
    const name = formData.get("name")?.toString().trim() ?? "";
    const url = formData.get("url")?.toString().trim() ?? "";
    const interval = Number(formData.get("interval_minutes") ?? initialValues.interval_minutes);
    const sensitivity = (formData.get("sensitivity") ?? initialValues.sensitivity) as MonitorSensitivity;
    const type = (formData.get("type") ?? mode) as MonitorMode;
    const selectorRaw = formData.get("selector_css")?.toString() ?? "";

    if (type === "section" && selectorRaw.trim().length === 0) {
      setError("CSS selector is required when monitoring a section.");
      setPending(false);
      return;
    }

    const payload: MonitorFormValues = {
      name,
      url,
      interval_minutes: interval as MonitorFormValues["interval_minutes"],
      sensitivity,
      type,
      selector_css: type === "section" ? selectorRaw.trim() : null,
    };

    try {
      await onSubmit(payload);
      if (successMessage) {
        setSuccess(successMessage);
      }
      if (resetOnSuccess) {
        formElement.reset();
        setMode(initialValues.type);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit form");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-muted)]">Monitor name</label>
          <input
            type="text"
            name="name"
            defaultValue={initialValues.name}
            required
            className="mt-1 w-full rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-muted)]">URL</label>
          <input
            type="url"
            name="url"
            defaultValue={initialValues.url}
            required
            className="mt-1 w-full rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-muted)]">Mode</label>
          <select
            name="type"
            className="mt-1 w-full rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]"
            value={mode}
            onChange={(event) => setMode(event.target.value as MonitorMode)}
          >
            <option value="page">Whole page</option>
            <option value="section">Section</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-muted)]">Interval</label>
          <select
            name="interval_minutes"
            className="mt-1 w-full rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]"
            defaultValue={initialValues.interval_minutes}
          >
            {MONITOR_INTERVAL_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-muted)]">Sensitivity</label>
          <select
            name="sensitivity"
            className="mt-1 w-full rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]"
            defaultValue={initialValues.sensitivity}
          >
            {MONITOR_SENSITIVITY_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {mode === "section" && (
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-muted)]">CSS selector</label>
          <input
            type="text"
            name="selector_css"
            defaultValue={initialValues.selector_css ?? ""}
            className="mt-1 w-full rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]"
            placeholder="#jobs-list li:first-child"
          />
        </div>
      )}
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {success && <p className="text-sm text-[var(--color-success)]">{success}</p>}
      <Button type="submit" disabled={pending} fullWidth={fullWidthButton}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
