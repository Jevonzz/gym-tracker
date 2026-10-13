"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/utils";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-sm font-bold tabular">
        {formatNumber(payload[0].value, 1)} {unit}
      </div>
    </div>
  );
}

export function TrendChart({ data, unit, height = 200 }: { data: { label: string; value: number }[]; unit: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axis} minTickGap={24} />
        <YAxis {...axis} width={44} domain={["dataMin - 5", "auto"]} tickFormatter={(v) => formatNumber(v)} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "var(--border)" }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          fill="url(#trendFill)"
          dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function VolumeChart({ data, unit, height = 200 }: { data: { label: string; volume: number }[]; unit: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axis} minTickGap={8} />
        <YAxis {...axis} width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--accent)", opacity: 0.5 }} />
        <Bar dataKey="volume" fill="var(--chart-1)" radius={[6, 6, 2, 2]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function WeightTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { payload: { weight: number; avg: number } }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const { weight, avg } = payload[0].payload;
  return (
    <div className="rounded-xl border border-border/60 bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-sm font-bold tabular">
        {formatNumber(weight, 1)} {unit}
      </div>
      <div className="text-muted-foreground tabular">7-day avg {formatNumber(avg, 1)}</div>
    </div>
  );
}

/** Daily weigh-ins as dots, the 7-day average as a line, and the goal (if set) as a dashed rule. */
export function BodyweightChart({
  data,
  goal,
  unit,
  height = 220,
}: {
  data: { label: string; weight: number; avg: number }[];
  goal: number | null;
  unit: string;
  height?: number;
}) {
  const values = goal == null ? data.map((d) => d.weight) : [...data.map((d) => d.weight), goal];
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 0.5);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axis} minTickGap={24} />
        <YAxis {...axis} width={44} domain={[lo, hi]} allowDecimals={false} tickFormatter={(v) => formatNumber(v)} />
        <Tooltip content={<WeightTooltip unit={unit} />} cursor={{ stroke: "var(--border)" }} />
        {goal != null && (
          <ReferenceLine
            y={goal}
            stroke="var(--chart-2)"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{ value: `Goal ${formatNumber(goal, 1)}`, position: "insideTopRight", fill: "var(--chart-2)", fontSize: 11 }}
          />
        )}
        <Line dataKey="weight" stroke="none" dot={{ r: 2.5, fill: "var(--muted-foreground)", strokeWidth: 0 }} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="avg"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
