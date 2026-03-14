"use client";

import React, { useEffect, useRef } from "react";

export default function ConfirmDialog(props: {
  open: boolean;
  title?: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const { open, title, description, onConfirm, onCancel, confirmLabel = "Confirmar", cancelLabel = "Cancelar" } = props;
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // focus confirm button when opened
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "confirm-title" : undefined}
      aria-describedby={description ? "confirm-desc" : undefined}
      className="fixed inset-0 z-60 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        ref={dialogRef}
        className="relative z-70 max-w-lg w-full rounded-2xl bg-(--tc-surface,#ffffff) p-5 shadow-[0_30px_80px_rgba(2,6,23,0.6)] ring-1 ring-(--tc-border,#e5e7eb)"
      >
        {title ? (
          <h3 id="confirm-title" className="mb-1 text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
            {title}
          </h3>
        ) : null}
        {description ? (
          <p id="confirm-desc" className="mb-4 text-sm text-(--tc-text-muted,#64748b)">
            {description}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-2 text-sm text-(--tc-text-muted,#6b7280) border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff)"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded-md px-3 py-2 text-sm font-semibold bg-(--tc-accent,#ef0001) text-white shadow-sm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
