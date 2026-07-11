import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

// Fluxos e Scripts sao os dois modos do mesmo estudio visual (AutomationStudio.tsx).
// A tela canonica com a alternancia entre os dois modos e /automacoes/ui-studio.
export default function AutomacoesFluxosAliasPage({ searchParams }: Props) {
  const flowValue = searchParams?.flow;
  const flow = Array.isArray(flowValue) ? flowValue[0] : flowValue;
  const qs = flow ? `?flow=${encodeURIComponent(flow)}` : "";
  redirect(`/automacoes/ui-studio${qs}`);
}
