"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

const applications = [
  { slug: "smart", name: "SMART", desc: "Releases monitoradas com graficos e detalhamento." },
  { slug: "print", name: "PRINT", desc: "Nenhuma release publicada ainda." },
  { slug: "booking", name: "BOOKING", desc: "Nenhuma release publicada ainda." },
  { slug: "trust", name: "TRUST", desc: "Nenhuma release publicada ainda." },
  { slug: "cidadao-smart", name: "CIDADAO SMART", desc: "Nenhuma release publicada ainda." },
  { slug: "mobile-griaule", name: "MOBILE GRIAULE", desc: "Nenhuma release publicada ainda." },
];

export default function Dashboard() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return applications;
    return applications.filter((app) => app.name.toLowerCase().includes(term));
  }, [query]);

  return (
    <div className="min-h-screen griaule-wall text-white p-6 md:p-10 space-y-10 flex flex-col items-center font-['Segoe_UI','Helvetica','Arial',sans-serif]">
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/images/griaule.svg"
          alt="Griaule"
          width={280}
          height={120}
          className="w-48 h-auto drop-shadow-[0_0_20px_rgba(124,211,67,0.4)]"
          priority
        />
        <p className="text-sm text-gray-200 text-center max-w-2xl">
          Escolha a aplicacao para visualizar graficos e releases. SMART ja possui releases monitoradas.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar aplicacao (ex: SMART)"
          className="w-full rounded-lg bg-[#1f2b3f] border border-[#2f3b4d] px-4 py-3 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7CD343]/60 focus:border-[#7CD343]/60 transition"
        />
      </div>

      <div className="w-full max-w-5xl grid gap-6 md:grid-cols-2">
        {filtered.map((app) => (
          <Link key={app.slug} href={`/applications/${app.slug}`} className="block h-full no-underline">
            <div className="h-full rounded-xl border border-[#2f3b4d] bg-[#1b2435] p-6 shadow-xl transition transform hover:-translate-y-1 hover:border-[#7CD343]/70 hover:shadow-[0_10px_40px_rgba(124,211,67,0.2)] cursor-pointer">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-wide text-white">{app.name}</h2>
                <p className="text-sm text-gray-300">{app.desc}</p>
                <p className="text-sm text-gray-300">Clique para abrir a aplicacao e ver graficos e releases.</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
