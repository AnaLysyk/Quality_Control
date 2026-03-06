import clsx from "clsx";

const STATUS_MAP = {
  healthy: {
    className: "bg-(--tc-success-bg) text-(--tc-success-text) border border-(--tc-success-border)",
    label: "Saudável",
    emoji: "🟢",
  },
  attention: {
    className: "bg-(--tc-warn-bg) text-(--tc-warn-text) border border-(--tc-warn-border)",
    label: "Atenção",
    emoji: "🟡",
  },
  risk: {
    className: "bg-(--tc-danger-bg) text-(--tc-danger-text) border border-(--tc-danger-border)",
    label: "Em risco",
    emoji: "🔴",
  },
} as const;

type BadgeProps = {
  status: keyof typeof STATUS_MAP;
  className?: string;
};

export default function Badge({ status, className }: BadgeProps) {
  const s = STATUS_MAP[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        s.className,
        className
      )}
    >
      <span aria-hidden="true">{s.emoji}</span>
      <span>{s.label}</span>
    </span>
  );
}
