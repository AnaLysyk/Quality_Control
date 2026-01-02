type RunStatusCardProps = {
  label: string;
  value: number;
  percent?: number;
  color: string;
  icon?: string;
};

export default function RunStatusCard({ label, value, percent = 0, color, icon }: RunStatusCardProps) {
  const pctLabel = Number.isFinite(percent) ? Math.round(percent) : 0;
  const bg = `${color}20`;
  const border = `${color}50`;

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between gap-4 border shadow-sm"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold"
          style={{ backgroundColor: `${color}33`, color }}
          aria-hidden
        >
          {icon ?? "•"}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
            {label}
          </span>
          <span className="text-sm text-[var(--tc-text-muted,#94a3b8)]">{pctLabel}%</span>
        </div>
      </div>
      <div className="text-2xl font-extrabold text-[var(--tc-text-inverse,#ffffff)]">{value}</div>
    </div>
  );
}
