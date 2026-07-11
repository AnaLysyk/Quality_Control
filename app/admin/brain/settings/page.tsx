import { BrainOrbitalConsole } from "@/brain/_components/BrainOrbitalConsole";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Configuracoes do Brain",
};

export default function BrainSettingsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <BrainOrbitalConsole />
    </div>
  );
}
