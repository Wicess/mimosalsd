"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { label: string; pageViews: number; productViews: number };

export function AnalyticsTrafficChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="pv-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="prod-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#f1f5f9" strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          stroke="transparent"
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          stroke="transparent"
          tickLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            fontSize: 12,
            boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12)",
          }}
          labelStyle={{ fontWeight: 600, color: "#0f172a" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          name="Page Views"
          type="monotone"
          dataKey="pageViews"
          stroke="#7c3aed"
          strokeWidth={2.5}
          fill="url(#pv-gradient)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0, fill: "#7c3aed" }}
        />
        <Area
          name="Product Views"
          type="monotone"
          dataKey="productViews"
          stroke="#10b981"
          strokeWidth={2.5}
          fill="url(#prod-gradient)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0, fill: "#10b981" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
