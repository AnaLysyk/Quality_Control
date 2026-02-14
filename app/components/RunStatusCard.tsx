import styles from "./RunStatusCard.module.css";

type RunStatusTone = "accent" | "info" | "success" | "warning" | "danger";

type RunStatusCardProps = {
  label: string;
  value: number;
  percent?: number;
  tone?: RunStatusTone;
  icon?: string;
};

export default function RunStatusCard({ label, value, percent = 0, tone = "accent", icon }: RunStatusCardProps) {
  const pctLabel = Number.isFinite(percent) ? Math.round(percent) : 0;
  const toneClass = styles[tone] ?? styles.accent;

  return (
    <div
      className={`rounded-2xl px-4 py-3 flex items-center justify-between gap-4 border shadow-sm ${styles.card} ${toneClass}`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold ${styles.icon}`} aria-hidden>
          {icon ?? "ƒ?½"}
        </div>
        <div className="flex flex-col leading-tight">
          <span className={`text-xs font-semibold uppercase tracking-wide ${styles.label}`}>{label}</span>
          <span className="text-sm text-[--tc-text-muted]">{pctLabel}%</span>
        </div>
      </div>
      <div className="text-2xl font-extrabold text-[--tc-text-inverse]">{value}</div>
    </div>
  );
}
