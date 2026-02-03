export const MONITOR_INTERVALS = [15, 60, 360, 720, 1440] as const;
export type MonitorInterval = (typeof MONITOR_INTERVALS)[number];

export const MONITOR_INTERVAL_OPTIONS: Array<{ label: string; value: MonitorInterval }> = [
  { label: "Every 15 minutes", value: 15 },
  { label: "Hourly", value: 60 },
  { label: "Every 6 hours", value: 360 },
  { label: "Every 12 hours", value: 720 },
  { label: "Daily", value: 1440 },
];

export const MONITOR_SENSITIVITIES = ["strict", "normal", "relaxed"] as const;
export type MonitorSensitivity = (typeof MONITOR_SENSITIVITIES)[number];

export const MONITOR_SENSITIVITY_OPTIONS: Array<{ label: string; value: MonitorSensitivity }> = [
  { label: "Strict", value: "strict" },
  { label: "Normal", value: "normal" },
  { label: "Relaxed", value: "relaxed" },
];

export type MonitorMode = "page" | "section";
