export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString();
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Unknown";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function describeInterval(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} min`;
}
