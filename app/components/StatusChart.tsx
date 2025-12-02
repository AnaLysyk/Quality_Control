"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface StatusChartProps {
  stats: {
    pass: number;
    fail: number;
    blocked: number;
    notRun: number;
  };
}

const COLORS = {
  pass: "#22c55e",
  fail: "#ef4444",
  blocked: "#facc15",
  notRun: "#6b7280",
};

export default function StatusChart({ stats }: StatusChartProps) {
  const chartEntries: { name: string; value: number; color: string }[] = [];
  if (stats.pass > 0) chartEntries.push({ name: "Pass", value: stats.pass, color: COLORS.pass });
  if (stats.fail > 0) chartEntries.push({ name: "Fail", value: stats.fail, color: COLORS.fail });
  if (stats.blocked > 0)
    chartEntries.push({ name: "Blocked", value: stats.blocked, color: COLORS.blocked });
  if (stats.notRun > 0)
    chartEntries.push({ name: "Not Run", value: stats.notRun, color: COLORS.notRun });

  const data = chartEntries.length
    ? chartEntries
    : [{ name: "Not Run", value: 1, color: COLORS.notRun }];

  return (
    <div className="w-full h-[320px] md:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius="80%"
            innerRadius="50%"
            paddingAngle={4}
            dataKey="value"
            label={false}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} casos`, name]}
            contentStyle={{
              backgroundColor: "#111827",
              borderRadius: "8px",
              border: "1px solid #1f2937",
              color: "#f8fafc",
              fontSize: "14px",
              padding: "10px 14px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
