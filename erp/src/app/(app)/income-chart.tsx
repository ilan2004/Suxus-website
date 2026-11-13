"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { rupees, fmtDate } from "@/lib/utils";

type Point = { date: string; label: string; amount: number };

export function IncomeChart({ data }: { data: Point[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div>
      <p className="mb-3 font-display text-2xl font-semibold tabular-nums">
        {rupees(total)} <span className="text-sm font-normal text-muted-foreground">in 30 days</span>
      </p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={4} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Point;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
                    <p className="text-xs text-muted-foreground">{fmtDate(p.date)}</p>
                    <p className="font-semibold tabular-nums">{rupees(p.amount)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
