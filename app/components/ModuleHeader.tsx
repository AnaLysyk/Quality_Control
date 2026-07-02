import type { ReactNode } from "react";
import clsx from "clsx";

type ModuleHeaderProps = {
  title: string;
  subtitle?: string;
  /** Breadcrumb / path display on the left. */
  breadcrumb?: ReactNode;
  /** Action buttons / controls on the right. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Standard page/module header with title, optional subtitle and action slot.
 *
 * Usage:
 * ```tsx
 * <ModuleHeader
 *   title="RepositÃ³rio de Casos"
 *   subtitle="Gerencie casos de teste"
 *   actions={<button>Novo caso</button>}
 * />
 * ```
 */
export function ModuleHeader({ title, subtitle, breadcrumb, actions, className }: ModuleHeaderProps) {
  return (
    <header className={clsx("flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between mb-5", className)}>
      <div className="flex flex-col gap-0.5">
        {breadcrumb && (
          <div className="text-xs text-[var(--tc-text-muted)] flex items-center gap-1">{breadcrumb}</div>
        )}
        <h1 className="text-xl font-bold tracking-tight text-[var(--tc-text)]">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[var(--tc-text-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 mt-3 sm:mt-0">{actions}</div>
      )}
    </header>
  );
}

