"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, PieLabelRenderProps } from "recharts";
import { STATUS_COLORS } from "@/utils/statusColors";

interface StatusChartProps {
  stats: {
    pass: number;
    fail: number;
    blocked: number;
    notRun: number;
  };
  hasData?: boolean;
  emptyLabel?: string;
  showLegend?: boolean;
}


const COLORS = STATUS_COLORS;

export default function StatusChart({ stats, hasData, emptyLabel, showLegend = false }: StatusChartProps) {
  const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
  const hasValidData = hasData ?? total > 0;

  const chartEntries: { name: string; value: number; color: string }[] = [];
  if (stats.pass > 0) chartEntries.push({ name: "Pass", value: stats.pass, color: COLORS.pass });
  if (stats.fail > 0) chartEntries.push({ name: "Fail", value: stats.fail, color: COLORS.fail });
  if (stats.blocked > 0) chartEntries.push({ name: "Blocked", value: stats.blocked, color: COLORS.blocked });
  if (stats.notRun > 0) chartEntries.push({ name: "Not Run", value: stats.notRun, color: COLORS.notRun });

  const data =
    hasValidData && chartEntries.length
      ? chartEntries
      : [{ name: "Sem execucoes", value: 1, color: "var(--tc-border,#94a3b8)" }];

  const pct = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const passPct = total > 0 ? Math.round((stats.pass / total) * 100) : 0;
  const ariaLabel = `Grafico de status: Pass ${stats.pass}, Fail ${stats.fail}, Blocked ${stats.blocked}, Not Run ${stats.notRun}, Total ${total}.`;

  const renderLabel = (props: PieLabelRenderProps) => {
    const { cx, cy, midAngle, outerRadius, value, fill } = props;
    if (
      typeof cx !== "number" ||
      typeof cy !== "number" ||
      typeof midAngle !== "number" ||
      typeof outerRadius !== "number"
    ) {
      return null;
    }
    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 0.78;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percent = pct(value);
    if (!percent) return null;
    return (
      <text
        x={x}
        y={y}
        fill={fill}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
      >
        {`${percent}%`}
      </text>
    );
  };

  return (
    <div className="w-full flex flex-col items-center gap-4" role="img" aria-label={ariaLabel}>
      <div className="relative w-full flex items-center justify-center">
        <div className="w-full max-w-90 aspect-square sm:max-w-105 md:max-w-130">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius="75%"
                innerRadius="55%"
                paddingAngle={3}
                dataKey="value"
                labelLine={false}
                label={renderLabel}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.color}
                    stroke="var(--tc-primary)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              {hasValidData && (
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} casos (${pct(value)}%)`, name]}
                  wrapperStyle={{ backgroundColor: "transparent", zIndex: 40 }}
                  contentStyle={{
                    backgroundColor: "var(--tc-primary-dark)",
                    borderRadius: "10px",
                    border: `1px solid var(--tc-border)`,
                    color: "var(--tc-text-inverse)",
                    fontSize: "14px",
                    padding: "10px 14px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                  }}
                  labelStyle={{ color: "var(--tc-text-inverse)" }}
                  itemStyle={{ color: "var(--tc-text-inverse)" }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center rounded-full bg-white px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.18)] border border-(--tc-border,#e5e7eb) min-w-30 text-(--tc-chart-center,#0b1a3c)">
            <span className="text-3xl font-extrabold leading-none">
              {hasValidData ? `${passPct}%` : "–"}
            </span>
            <span className="text-[11px] uppercase tracking-[0.22em] text-[#475569] mt-1">
              {hasValidData ? "Pass" : emptyLabel ?? "Sem execucoes"}
            </span>
            <span className="text-xs text-(--tc-chart-subtext,#475569)">Total {hasValidData ? total : 0}</span>
          </div>
        </div>
      </div>

      {showLegend && hasValidData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm text-(--tc-text-inverse) w-full">
          {[
            { name: "Pass", value: stats.pass, color: COLORS.pass },
            { name: "Fail", value: stats.fail, color: COLORS.fail },
            { name: "Blocked", value: stats.blocked, color: COLORS.blocked },
            { name: "Not Run", value: stats.notRun, color: COLORS.notRun },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 rounded-xl border border-(--tc-border)/20 bg-(--tc-surface-dark) px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.25)] justify-between"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-3.5 w-3.5 rounded-full ring-2 ring-(--tc-primary) legend-dot-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                />
                <span className="font-semibold">{item.name}</span>
              </div>
              <div className="text-right leading-tight">
                <div className="font-bold text-(--tc-text-inverse)">{item.value}</div>
                <div className="text-[11px] text-(--tc-text-muted)">{pct(item.value)}%</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

