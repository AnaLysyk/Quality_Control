import { BrainQaCommandCenter } from "../qa/_components/BrainQaCommandCenter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Brain - Validações",
  description: "Eval Center do Brain",
};

export default function BrainValidacoesPage() {
  return <BrainQaCommandCenter />;
}
