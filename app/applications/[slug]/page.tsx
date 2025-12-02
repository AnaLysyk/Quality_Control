import Link from "next/link";
import { releaseOrder, releasesData } from "@/release/data";

const appMeta: Record<
  string,
  {
    name: string;
    description: string;
    color: string;
  }
> = {
  smart: { name: "SMART", description: "Releases monitoradas com gráficos e detalhamento.", color: "#7CD343" },
  print: { name: "PRINT", description: "Releases específicas do PRINT.", color: "#4F9DFF" },
  booking: { name: "BOOKING", description: "Releases e validações pretendidas.", color: "#9C6CFF" },
  trust: { name: "TRUST", description: "Releases e QA desta aplicação.", color: "#FFA73A" },
  "cidadao-smart": { name: "CIDADÃO SMART", description: "Releases focadas no cidadão SMART.", color: "#00E5FF" },
  "mobile-griaule": { name: "MOBILE GRIAULE", description: "Releases mobile do ecossistema Griaule.", color: "#FFD84D" },
};

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ slug?: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug?.toLowerCase();
  if (!slug) {
    return (
      <div className="min-h-screen griaule-wall p-10 text-white">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h1 className="text-3xl font-bold">Aplicação inválida</h1>
          <p className="text-gray-400">
            Você precisa acessar uma rota específica como <code>/applications/smart</code>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-[#7CD343] hover:border-[#7CD343] transition"
          >
            Voltar ao Painel QA →
          </Link>
        </div>
      </div>
    );
  }

  const app = appMeta[slug];

  if (!app) {
    return (
      <div className="min-h-screen p-10 griaule-wall text-white">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h1 className="text-3xl font-bold">Aplicação não encontrada</h1>
          <p className="text-gray-400">
            Esta rota ainda não foi mapeada. Volte ao Painel QA e selecione outra aplicação.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-[#7CD343] hover:border-[#7CD343] transition"
          >
            Voltar ao Painel QA →
          </Link>
        </div>
      </div>
    );
  }

  const releases = releaseOrder
    .map((id) => ({ id, data: releasesData[id] }))
    .filter((entry) => entry.data.app === slug);

  return (
    <div className="min-h-screen griaule-wall p-10 text-white">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-[#7CD343]">Aplicação</p>
            <h1 className="text-4xl font-bold">{app.name}</h1>
            <p className="text-gray-300">{app.description}</p>
          </div>
          <span
            className="text-xs font-bold uppercase rounded-full px-3 py-1 text-black"
            style={{ backgroundColor: app.color }}
          >
            {app.name}
          </span>
        </div>

        {releases.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#101528] p-8 text-center text-gray-400">
            Nenhuma release disponível para esta aplicação.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {releases.map((release) => (
              <Link
                key={release.id}
                href={`/release/${release.id}`}
                className="group block rounded-2xl border border-white/10 bg-[#101528] p-6 transition hover:border-[#7CD343]/70 hover:shadow-[0_20px_40px_rgba(124,211,67,0.25)]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-[#888]">{release.id.replace(/_/g, " ")}</p>
                  <span
                    className="text-xs font-semibold uppercase rounded-full px-3 py-1 text-black"
                    style={{ backgroundColor: app.color }}
                  >
                    {app.name}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold mt-3 text-white">{release.data.title}</h2>
                <p className="text-gray-400 mt-2 text-sm leading-relaxed">{release.data.summary}</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#7CD343]">
                  Abrir release →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
