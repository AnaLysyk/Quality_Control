import Link from "next/link";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyHomePage({ params }: PageProps) {
  const { slug } = await params;
  const safeSlug = encodeURIComponent(slug);

  const cards = [
    { title: "Dashboard", description: "Resumo executivo, alertas e qualidade.", href: `/empresas/${safeSlug}/dashboard` },
    { title: "Runs", description: "Execucoes manuais e historico de testes.", href: `/empresas/${safeSlug}/runs` },
    { title: "Releases", description: "Releases e relatorios detalhados.", href: `/empresas/${safeSlug}/releases` },
    { title: "Defeitos", description: "Lista e gestao de defeitos manuais.", href: `/empresas/${safeSlug}/defeitos` },
    { title: "Kanban", description: "Organizacao visual de defeitos por status.", href: `/empresas/${safeSlug}/defeitos/kanban` },
    { title: "Aplicacoes", description: "Mapa das aplicacoes da empresa.", href: `/empresas/${safeSlug}/aplicacoes` },
  ];

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c) px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="rounded-3xl bg-white/90 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Quality Control</p>
          <h1 className="mt-2 text-3xl font-extrabold">Hub da empresa: {slug}</h1>
          <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
            Acesse os modulos essenciais para acompanhar qualidade, runs, releases e defeitos.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="flex h-full flex-col gap-3 rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-(--page-text,#0b1a3c)">{card.title}</h2>
              <p className="text-sm text-(--tc-text-secondary,#4b5563)">{card.description}</p>
              <span className="mt-auto text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-accent,#ef0001)">
                Abrir
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
