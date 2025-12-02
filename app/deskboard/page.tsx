import Link from "next/link";

const applications = [
  { name: "SMART", slug: "smart", description: "Releases monitoradas com gráficos e detalhamento." },
  { name: "PRINT", slug: "print", description: "Nenhuma release publicada ainda." },
  { name: "BOOKING", slug: "booking", description: "Nenhuma release publicada ainda." },
  { name: "TRUST", slug: "trust", description: "Nenhuma release publicada ainda." },
  { name: "CIDADAO SMART", slug: "cidadao-smart", description: "Nenhuma release publicada ainda." },
  { name: "MOBILE GRIAULE", slug: "mobile-griaule", description: "Nenhuma release publicada ainda." },
];

export default function DeskboardPage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.5em] text-[#7CD343]">Deskboard</p>
          <h1 className="text-4xl font-extrabold">Aplicações monitoradas</h1>
          <p className="text-gray-300 max-w-3xl">
            Acesse rapidamente cada aplicação e visualize as releases disponíveis no painel de QA.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((application) => (
            <Link
              key={application.slug}
              href={`/applications/${application.slug}`}
              className="group rounded-2xl border border-white/10 bg-[#0f1527] p-5 shadow-lg shadow-black/50 transition hover:border-[#7CD343]/60"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-[0.4em]">{application.slug}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{application.name}</span>
              </div>
              <p className="text-sm text-gray-300 mt-4">{application.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
