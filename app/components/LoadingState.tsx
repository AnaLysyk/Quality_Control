import clsx from "clsx";

type LoadingStateProps = {
  message?: string;
  className?: string;
};

export function LoadingState({ message = "Carregando...", className }: LoadingStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-3 py-14 px-6 text-center",
        className,
      )}
    >
      <div
        className="w-8 h-8 rounded-full border-2 border-[var(--tc-accent,#3b82f6)] border-t-transparent animate-spin"
        role="status"
        aria-label={message}
      />
      <p className="text-[var(--tc-text-muted)] text-sm">{message}</p>
    </div>
  );
}

