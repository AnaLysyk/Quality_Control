import { ComponentProps, ReactNode } from "react";
import clsx from "clsx";

type CardProps = {
  children: ReactNode;
  className?: string;
} & ComponentProps<"div">;

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        "card-tc bg-[var(--tc-surface-dark)] text-[var(--tc-text-inverse)] border-[var(--tc-border)]/20",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionCard({ children, className, ...rest }: CardProps) {
  return (
    <Card
      className={clsx(
        "rounded-2xl p-5 md:p-6 shadow-[0_18px_38px_rgba(0,0,0,0.25)]",
        className
      )}
      {...rest}
    >
      {children}
    </Card>
  );
}
