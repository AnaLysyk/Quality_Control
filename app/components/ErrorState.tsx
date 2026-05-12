import type { ReactNode } from "react";
import clsx from "clsx";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Algo deu errado",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-3 py-14 px-6 text-center",
        className,
      )}
    >
      <div className="text-red-400 text-4xl opacity-60">⚠</div>
      <p className="font-semibold text-(--tc-text) text-sm">{title}</p>
      {message && (
        <p className="text-(--tc-text-muted) text-sm max-w-xs">{message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-lg px-4 py-1.5 text-sm font-medium bg-(--tc-accent,#3b82f6) text-white hover:opacity-90 transition-opacity"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
