import type { ReactNode } from "react";
import clsx from "clsx";

type EmptyStateProps = {
  title?: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({ title = "Nenhum item encontrado", message, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-3 py-14 px-6 text-center",
        className,
      )}
    >
      {icon && (
        <div className="text-[var(--tc-text-muted)] opacity-40 mb-1 text-4xl">{icon}</div>
      )}
      <p className="font-semibold text-[var(--tc-text)] text-sm">{title}</p>
      {message && (
        <p className="text-[var(--tc-text-muted)] text-sm max-w-xs">{message}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

