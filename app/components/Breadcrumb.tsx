import Link from "next/link";
import type { ReactNode } from "react";

export type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
  title?: string;
  className?: string;
};

type Props = {
  items: BreadcrumbItem[];
  className?: string;
};

export default function Breadcrumb({ items, className }: Props) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const lastIndex = Math.max(0, list.length - 1);

  const breadcrumbElements: ReactNode[] = [];
  list.forEach((item, index) => {
    const isLast = index === lastIndex;
    const baseClass = `min-w-0 truncate ${item.className ?? ""}`.trim();
    const content = !isLast && item.href ? (
      <Link
        href={item.href}
        prefetch={false}
        className={`${baseClass} hover:underline hover:text-[--tc-accent]`}
        title={item.title}
      >
        {item.label}
      </Link>
    ) : (
      <span
        className={`${baseClass}${isLast ? " text-[--tc-text-secondary]" : ""}`}
        aria-current={isLast ? "page" : undefined}
        title={item.title}
      >
        {item.label}
      </span>
    );

    if (index > 0) {
      breadcrumbElements.push(
        <li key={`sep-${index}`} aria-hidden="true" className="flex items-center">
          <span className="mx-1 opacity-60">/</span>
        </li>
      );
    }

    breadcrumbElements.push(
      <li key={`item-${index}`} className="flex min-w-0 items-center">
        {content}
      </li>
    );
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={className ?? "text-xs sm:text-sm text-[--tc-text-muted]"}
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">{breadcrumbElements}</ol>
    </nav>
  );
}
