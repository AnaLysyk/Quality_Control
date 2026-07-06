import type { ReactNode } from "react";
import AdminDashboardPrintShell from "../dashboard/AdminDashboardPrintShell";
import styles from "./visao-geral-clean.module.css";

export default function AdminOverviewLayout({ children }: { children: ReactNode }) {
  return (
    <AdminDashboardPrintShell>
      <div className={styles.visaoGeralClean}>{children}</div>
    </AdminDashboardPrintShell>
  );
}
