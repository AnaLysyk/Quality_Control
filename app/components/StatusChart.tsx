"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
  // 🔥 Cria somente fatias que têm valor > 0
  const data: { name: string; value: number; color: string }[] = [];
  if (stats.pass > 0) {
    data.push({ name: "Pass", value: stats.pass, color: COLORS.pass });
  }
  if (stats.fail > 0) {
    data.push({ name: "Fail", value: stats.fail, color: COLORS.fail });
  }
  if (stats.blocked > 0) {
    data.push({ name: "Blocked", value: stats.blocked, color: COLORS.blocked });
  }
  if (stats.notRun > 0) {
    data.push({ name: "Not Run", value: stats.notRun, color: COLORS.notRun });
  }

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* ------- GRÁFICO -------- */}
      <div className="w-full h-[420px] flex items-center justify-center">
        <ResponsiveContainer width="60%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={170}
              innerRadius={90}
              paddingAngle={3}
              dataKey="value"
              label={false}
            >
              {data.map((entry: any, i: number) => (
                <Cell
                  key={i}
                  fill={entry.color}
                  stroke="#1f2937"
                  strokeWidth={2}
                />
              ))}
            </Pie>

            {/* Tooltip bonita e legível */}
            <Tooltip
              formatter={(value: number, name: string) => [`${value} casos`, name]}
              contentStyle={{
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "#fff",
                fontSize: "14px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* ------- LEGENDA INFERIOR -------- */}
      <div className="mt-6 grid grid-cols-4 gap-6 text-center w-full max-w-4xl">
        <div>
          <p className="text-sm text-green-400 font-bold">Pass</p>
          <p className="text-white text-lg">{stats.pass}</p>
        </div>

        <div>
          <p className="text-sm text-red-400 font-bold">Fail</p>
          <p className="text-white text-lg">{stats.fail}</p>
        </div>

        <div>
          <p className="text-sm text-yellow-300 font-bold">Blocked</p>
          <p className="text-white text-lg">{stats.blocked}</p>
        </div>

        <div>
          <p className="text-sm text-gray-400 font-bold">Not Run</p>
          <p className="text-white text-lg">{stats.notRun}</p>
        </div>
      </div>
    </div>
  );
}
