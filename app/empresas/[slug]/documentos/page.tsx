"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type DocItem = {
  title: string;
  description: string;
  url: string;
};

// Configuração em código (sem banco)
const DOCUMENTOS: Record<string, DocItem[]> = {
  admin: [
    {
      title: "Governança de Qualidade",
      description: "Padrões de QA e critérios de aceite",
      url: "https://example.com/governanca",
    },
  ],
  testingcompany: [
    {
      title: "Onboarding do Cliente",
      description: "Fluxo de implantação e checklist inicial",
      url: "https://example.com/onboarding",
    },
  ],
};

export default function DocumentosPage() {
  const { slug } = useParams<{ slug: string }>();
  const normalized = (slug || "").toLowerCase();
  const [extras, setExtras] = useState<DocItem[]>(() => {
    if (!normalized) return [];
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(`docs_${normalized}`) : null;
    return raw ? (JSON.parse(raw) as DocItem[]) : [];
  });

  const docs = useMemo(() => {
    const base = DOCUMENTOS[normalized] || DOCUMENTOS.admin || [];
    return [...base, ...extras];
  }, [normalized, extras]);

  function addDoc(item: DocItem) {
    const next = [...extras, item];
    setExtras(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`docs_${normalized}`, JSON.stringify(next));
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 uppercase tracking-[0.18em]">Documentações</p>
          <h1 className="text-2xl font-semibold">Empresa: {slug}</h1>
        </div>
        <AddDocButton onAdd={addDoc} />
      </div>

      {docs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-slate-600">
          Nenhum documento cadastrado ainda. Use &quot;Adicionar link&quot; para incluir um atalho rápido.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {docs.map((doc, idx) => (
            <article
              key={`${doc.title}-${idx}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <h2 className="text-lg font-semibold">{doc.title}</h2>
              <p className="text-sm text-slate-600">{doc.description}</p>
              <Link
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline"
              >
                Acessar
                <span aria-hidden>↗</span>
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function AddDocButton({ onAdd }: { onAdd: (item: DocItem) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  function submit() {
    if (!title || !url) return;
    onAdd({ title, description, url });
    setTitle("");
    setDescription("");
    setUrl("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:border-indigo-300 hover:text-indigo-600"
      >
        Adicionar link
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <input
        className="rounded border border-slate-200 px-2 py-1 text-sm"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="rounded border border-slate-200 px-2 py-1 text-sm"
        placeholder="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        className="rounded border border-slate-200 px-2 py-1 text-sm"
        placeholder="URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          className="flex-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
