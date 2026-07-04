"use client";

import type { ReactNode } from "react";

export default function AdminDashboardPrintShell({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-pdf-root">
      <style jsx global>{`
        @media print {
          .dashboard-print-hidden,
          .dashboard-pdf-root button,
          .dashboard-pdf-root input,
          .dashboard-pdf-root select {
            display: none !important;
          }

          .dashboard-pdf-root section,
          .dashboard-pdf-root article,
          .dashboard-pdf-root aside,
          .dashboard-pdf-root tr {
            break-inside: avoid;
          }

          .dashboard-pdf-root {
            background: #ffffff !important;
            color: #0f172a !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
