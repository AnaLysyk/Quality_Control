"use client";

import type { ReactNode } from "react";
import { FiDownload } from "react-icons/fi";
import styles from "./page.module.css";

export default function DashboardPrintShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.printRoot}>
      <div className={styles.printActions}>
        <button type="button" onClick={() => window.print()} className={styles.printButton}>
          <FiDownload className="h-4 w-4" /> Gerar PDF
        </button>
      </div>
      {children}
    </div>
  );
}
