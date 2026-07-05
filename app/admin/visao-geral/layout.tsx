import type { ReactNode } from "react";
import AdminDashboardPrintShell from "../dashboard/AdminDashboardPrintShell";
import styles from "./visao-geral-theme.module.css";

export default function AdminOverviewLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.overviewTheme}>
      <AdminDashboardPrintShell>{children}</AdminDashboardPrintShell>
    </div>
  );
}
