import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type PolymorphicProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function TcPage<T extends ElementType = "div">({
  as,
  className,
  children,
  ...props
}: PolymorphicProps<T>) {
  const Component = as ?? "div";
  return (
    <Component className={cn("tc-page text-text", className)} {...props}>
      {children}
    </Component>
  );
}

export function TcCard<T extends ElementType = "section">({
  as,
  className,
  children,
  ...props
}: PolymorphicProps<T>) {
  const Component = as ?? "section";
  return (
    <Component className={cn("tc-section rounded-2xl p-4", className)} {...props}>
      {children}
    </Component>
  );
}

type TcButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function TcButton({ className, variant = "primary", type = "button", ...props }: TcButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant === "primary" ? undefined : variant}
      className={cn("tc-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold", className)}
      {...props}
    />
  );
}

export function TcInput({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn("tc-input rounded-xl px-3 py-2 text-sm", className)} {...props} />;
}

export function TcSelect({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={cn("tc-select rounded-xl px-3 py-2 text-sm", className)} {...props} />;
}

export function TcTextarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn("tc-textarea rounded-xl px-3 py-2 text-sm", className)} {...props} />;
}

type TcBadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function TcBadge({ className, tone = "neutral", ...props }: TcBadgeProps) {
  return (
    <span
      data-tone={tone === "neutral" ? undefined : tone}
      className={cn("tc-badge inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", className)}
      {...props}
    />
  );
}
