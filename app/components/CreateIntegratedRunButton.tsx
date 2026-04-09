"use client";

import React from "react";
import { FiPlus } from "react-icons/fi";

type Props = {
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export function CreateIntegratedRunButton({ onClick, disabled, children, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] ${className ?? ""}`}
      aria-label={typeof children === "string" ? children : "Create integrated run"}
      title={typeof children === "string" ? children : "Create integrated run"}
    >
      <FiPlus size={14} />
      {children ?? "Create integrated run"}
    </button>
  );
}
