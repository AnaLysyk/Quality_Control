import clsx from "clsx";
import { StatusKey } from "@/utils/statusColors";
import styles from "./StatCard.module.css";

type StatCardProps = {
  label: string;
  value: number | string;
  percent?: number;
  tone?: StatusKey | "inverse";
  className?: string;
};

export default function StatCard({ label, value, percent, tone = "inverse", className }: StatCardProps) {
  const toneClass = styles[tone] ?? styles.inverse;

  return (
    <div
      className={clsx(
        "rounded-xl border border-(--tc-border)/20 bg-white/5 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.25)]",
        className
      )}
    >
      <p className="text-xs text-(--tc-text-muted)">{label}</p>
      <p className={clsx("text-xl font-bold", styles.value, toneClass)}>{value}</p>
      {percent !== undefined && (
        <p className="text-xs text-(--tc-text-secondary)">
          {Math.round(percent)}%
        </p>
      )}
    </div>
  );
}
