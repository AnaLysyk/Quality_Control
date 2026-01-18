import clsx from "clsx";

const STATUS_MAP = {
  healthy: { color: "bg-emerald-100 text-emerald-700", label: "Saudável", emoji: "🟢" },
  attention: { color: "bg-amber-100 text-amber-700", label: "Atenção", emoji: "🟡" },
  risk: { color: "bg-red-100 text-red-700", label: "Em risco", emoji: "🔴" },
};

type BadgeProps = {
  status: "healthy" | "attention" | "risk";
  className?: string;
};

export default function Badge({ status, className }: BadgeProps) {
  const s = STATUS_MAP[status] || STATUS_MAP.healthy;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", s.color, className)}>
      <span>{s.emoji}</span>
      <span>{s.label}</span>
    </span>
  );
}
