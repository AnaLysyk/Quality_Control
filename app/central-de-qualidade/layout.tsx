import type { ReactNode } from "react";
import DashboardPrintShell from "./DashboardPrintShell";

export default function CentralDeQualidadeLayout({ children }: { children: ReactNode }) {
  return <DashboardPrintShell>{children}</DashboardPrintShell>;
}

