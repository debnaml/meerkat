interface StatusMeta {
  label: string;
  description: string;
  colorClasses: string;
}

const STATUS_BADGE_BASE =
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors";

const STATUS_META: Record<string, StatusMeta> = {
  ok: {
    label: "OK",
    description: "Latest automated check succeeded without issues.",
    colorClasses: "border-[var(--color-success-ink)] bg-[var(--color-success-soft)] text-[var(--color-success-ink)]",
  },
  error: {
    label: "Error",
    description: "Last run failed; review recent checks for details.",
    colorClasses: "border-[var(--color-danger-ink)] bg-[var(--color-danger-soft)] text-[var(--color-danger-ink)]",
  },
  blocked: {
    label: "Blocked",
    description: "Site returned a blocked/forbidden response during the last check.",
    colorClasses: "border-[var(--color-warning-ink)] bg-[var(--color-warning-soft)] text-[var(--color-warning-ink)]",
  },
  pending: {
    label: "Pending",
    description: "Waiting for the first successful check to complete.",
    colorClasses: "border-[var(--color-border-muted)] bg-[var(--color-neutral-soft)] text-[var(--color-neutral-ink)]",
  },
  unknown: {
    label: "Unknown",
    description: "Status unavailable; monitor has not reported recently.",
    colorClasses: "border-[var(--color-border-muted)] bg-[var(--color-neutral-soft)] text-[var(--color-neutral-ink)]",
  },
};

interface StatusBadgeProps {
  status: string | null;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status?.toLowerCase() ?? "pending";
  const meta = STATUS_META[key] ?? STATUS_META.unknown;
  const classes = className ? `${STATUS_BADGE_BASE} ${meta.colorClasses} ${className}` : `${STATUS_BADGE_BASE} ${meta.colorClasses}`;

  return (
    <span className={classes} title={meta.description}>
      {meta.label}
    </span>
  );
}
