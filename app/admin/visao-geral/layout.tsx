import type { ReactNode } from "react";
import AdminDashboardPrintShell from "../dashboard/AdminDashboardPrintShell";

export default function AdminOverviewLayout({ children }: { children: ReactNode }) {
  return <AdminDashboardPrintShell>{children}</AdminDashboardPrintShell>;
}
