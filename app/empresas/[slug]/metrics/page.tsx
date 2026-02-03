type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyMetricsPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c) px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Metricas</p>
          <h1 className="mt-2 text-3xl font-extrabold">Metricas da empresa {slug}</h1>
          <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
            Painel resumido de indicadores e metas de qualidade.
          </p>
        </header>
      </div>
    </div>
  );
}
