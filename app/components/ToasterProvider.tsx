"use client";

import { Toaster } from "react-hot-toast";

export default function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: "var(--tc-surface-dark, #0f1828)",
          color: "var(--tc-text-inverse, #fff)",
          border: "1px solid var(--surface-border, rgba(255,255,255,0.10))",
        },
      }}
    />
  );
}
