import { ReleaseCalendarPanel } from "./_components/ReleaseCalendarPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Agenda",
  description: "Calendário operacional de releases e entregas",
};

export default function AgendaPage() {
  return <ReleaseCalendarPanel />;
}
