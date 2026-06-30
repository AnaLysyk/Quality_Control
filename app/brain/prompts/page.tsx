import { BrainQaCommandCenter } from "../qa/_components/BrainQaCommandCenter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Brain - Prompt Registry",
  description: "Prompts versionados do Brain",
};

export default function BrainPromptsPage() {
  return <BrainQaCommandCenter />;
}
