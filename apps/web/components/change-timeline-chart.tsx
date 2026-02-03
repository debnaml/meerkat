"use client";

import type { TooltipProps } from "recharts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChangeTimelinePoint {
  label: string;
  value: number;
}

interface ChangeTimelineChartProps {
  data: ChangeTimelinePoint[];
}

function TimelineTooltip({ active, payload, label }: TooltipProps<string, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const value = payload[0]?.value ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="text-slate-500">{value} change{value === 1 ? "" : "s"}</p>
    </div>
  );
}

export function ChangeTimelineChart({ data }: ChangeTimelineChartProps) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="changes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f172a" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
          />
          <Tooltip content={<TimelineTooltip />} cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4" }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#0f172a"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#changes)"
            dot={{ r: 3, strokeWidth: 2, fill: "#fff", stroke: "#0f172a" }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
