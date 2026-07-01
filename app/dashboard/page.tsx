export const dynamic = "force-dynamic";

import DashboardClient from "./DashboardClient";
import DashboardPrintShell from "./DashboardPrintShell";

export default function DashboardPage() {
  return (
    <DashboardPrintShell>
      <DashboardClient />
    </DashboardPrintShell>
  );
}
