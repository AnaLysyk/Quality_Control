import { BrainSourcesSettings } from "@/brain/_components/BrainSourcesSettings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Configuracoes do Brain",
};

export default function BrainSettingsPage() {
  return <BrainSourcesSettings />;
}
