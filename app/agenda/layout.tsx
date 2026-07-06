import type { ReactNode } from "react";
import AgendaMeetingSchedulerLite from "./_components/AgendaMeetingSchedulerLite";

export default function AgendaLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <AgendaMeetingSchedulerLite />
      {children}
    </div>
  );
}
