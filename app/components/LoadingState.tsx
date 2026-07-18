import clsx from "clsx";

import { Spinner } from "./ui/spinner";

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
      <Spinner size={40} label={message} />
      <p className="text-[var(--tc-text-muted)] text-sm">{message}</p>
    </div>
  );
}

