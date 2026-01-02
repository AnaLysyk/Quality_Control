import { STATUS_COLORS, StatusKey } from "@/utils/statusColors";
import clsx from "clsx";

type StatusPillProps = {
  label: string;
  value?: number | string;
  percent?: number;
  colorKey?: StatusKey;
  color?: string;
  className?: string;
};

export default function StatusPill({
  label,
  value,
  percent,
  colorKey,
  color,
  className,
}: StatusPillProps) {
  const resolvedColor = color ?? (colorKey ? STATUS_COLORS[colorKey] : "var(--tc-accent)");

  return (
    <div className={clsx("flex items-center gap-2 rounded-full bg-white/5 border border-[var(--tc-border)]/20 px-3 py-2", className)}>
      <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: resolvedColor }} />
      <span className="font-semibold" style={{ color: resolvedColor }}>
        {label}
      </span>
      {value !== undefined && (
        <span className="text-[var(--tc-text-inverse)]">
          {value}{" "}
          {percent !== undefined && <span className="text-[var(--tc-text-muted)]">({percent}%)</span>}
        </span>
      )}
    </div>
  );
}
