"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatAed, formatAedCompact, formatShortDate } from "@/lib/format";

type Point = { date: string; total: number };

function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="text-muted">{formatShortDate(point.date)}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatAed(point.total)}</p>
    </div>
  );
}

/** Single-series revenue trend: one hue, recessive grid, crosshair tooltip, plus a data table for screen readers. */
export function RevenueChart({ data }: { data: Point[] }) {
  return (
    <figure>
      <div className="h-56 sm:h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => formatAedCompact(v).replace("AED", "").trim()}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--series-1)"
              strokeWidth={2}
              fill="url(#revenue-fill)"
              activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Revenue per day in AED for the last {data.length} days.</figcaption>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer hover:text-foreground">Show data table</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr>
              <th scope="col" className="py-1 text-left font-medium">Date</th>
              <th scope="col" className="py-1 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="py-1">{formatShortDate(d.date)}</td>
                <td className="py-1 text-right tabular-nums">{formatAed(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
