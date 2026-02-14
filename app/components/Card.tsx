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
        "card-tc bg-[--tc-surface-dark] text-[--tc-text-inverse] border-[--tc-border]/20",
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
        "card-tc bg-[--tc-surface-dark] text-[--tc-text-inverse] border-[--tc-border]/20",
        className
      )}
      {...rest}
    >
      {children}
    </Card>
  );
}
