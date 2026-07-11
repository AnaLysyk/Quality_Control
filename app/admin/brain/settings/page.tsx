import { BrainOrbitalConsole } from "@/brain/_components/BrainOrbitalConsole";
import { BrainProviderConfigPanel } from "../BrainProviderConfigPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Configuracoes do Brain",
};

export default function BrainSettingsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-7xl px-6 pt-6">
        <BrainProviderConfigPanel embedded />
      </section>
      <BrainOrbitalConsole />
    </div>
  );
}
