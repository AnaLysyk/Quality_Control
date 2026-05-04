import clsx from "clsx";

const STATUS_MAP = {
  healthy: {
    className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
    label: "Saudável",
  },
  attention: {
    className: "border border-amber-200 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
    label: "Atenção",
  },
  risk: {
    className: "border border-rose-200 bg-rose-50 text-rose-700",
    dotClassName: "bg-rose-500",
    label: "Em risco",
  },
} as const;

type BadgeProps = {
  status: keyof typeof STATUS_MAP;
  className?: string;
};

export default function Badge({ status, className }: BadgeProps) {
  const tone = STATUS_MAP[status];

  return (
    <span className={clsx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", tone.className, className)}>
      <span aria-hidden="true" className={clsx("h-2 w-2 rounded-full", tone.dotClassName)} />
      <span>{tone.label}</span>
    </span>
  );
}
