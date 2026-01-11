import { StatusKey } from "@/utils/statusColors";
import clsx from "clsx";
import styles from "./StatusPill.module.css";

type StatusPillProps = {
  label: string;
  value?: number | string;
  percent?: number;
  colorKey?: StatusKey;
  className?: string;
};

export default function StatusPill({
  label,
  value,
  percent,
  colorKey,
  className,
}: StatusPillProps) {
  const colorClass = colorKey ? styles[colorKey] : undefined;

  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-full bg-white/5 border border-(--tc-border)/20 px-3 py-2",
        styles.pill,
        colorClass,
        className,
      )}
    >
      <span className={clsx("inline-flex h-2.5 w-2.5 rounded-full", styles.dot)} />
      <span className={clsx("font-semibold", styles.label)}>
        {label}
      </span>
      {value !== undefined && (
        <span className="text-(--tc-text-inverse)">
          {value}{" "}
          {percent !== undefined && <span className="text-(--tc-text-muted)">({percent}%)</span>}
        </span>
      )}
    </div>
  );
}
