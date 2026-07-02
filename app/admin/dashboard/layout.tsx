import type { ReactNode } from "react";
import AdminDashboardPrintShell from "./AdminDashboardPrintShell";

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return <AdminDashboardPrintShell>{children}</AdminDashboardPrintShell>;
}

