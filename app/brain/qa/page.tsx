import { BrainQaCommandCenter } from "./_components/BrainQaCommandCenter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Brain QA",
  description: "Validacoes, prompts e acoes rapidas do Brain",
};

export default function BrainQaPage() {
  return <BrainQaCommandCenter />;
}
