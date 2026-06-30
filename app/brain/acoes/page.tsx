import { BrainQaCommandCenter } from "../qa/_components/BrainQaCommandCenter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Brain - Ações rápidas",
  description: "Ações rápidas de QA do Brain",
};

export default function BrainAcoesPage() {
  return <BrainQaCommandCenter />;
}
