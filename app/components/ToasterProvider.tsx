"use client";

import { Toaster } from "react-hot-toast";

export default function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: "var(--tc-surface-dark)",
          color: "var(--tc-text-inverse)",
          border: "1px solid var(--tc-border)",
        },
      }}
    />
  );
}
