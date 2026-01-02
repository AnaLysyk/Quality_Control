import clsx from "clsx";

type StatCardProps = {
  label: string;
  value: number | string;
  percent?: number;
  color?: string;
  className?: string;
};

export default function StatCard({ label, value, percent, color, className }: StatCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-[var(--tc-border)]/20 bg-white/5 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.25)]",
        className
      )}
    >
      <p className="text-xs text-[var(--tc-text-muted)]">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
      </p>
      {percent !== undefined && (
        <p className="text-xs text-[var(--tc-text-secondary)]">
          {Math.round(percent)}%
        </p>
      )}
    </div>
  );
}
