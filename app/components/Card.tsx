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
        "card-tc border border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary)",
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
        "rounded-[24px] p-5 sm:p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]",
        className
      )}
      {...rest}
    >
      {children}
    </Card>
  );
}
