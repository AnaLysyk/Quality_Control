import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";

const DOC_FILES: Record<string, { title: string; filePath: string; kind: "markdown" | "code"; language?: string }>
  = {
    arquitetura_front: {
      title: "Arquitetura — Frontend (Next.js)",
      filePath: "docs/arquitetura_front.md",
      kind: "markdown",
    },
    arquitetura_api: {
      title: "Arquitetura — API (app/api)",
      filePath: "docs/arquitetura_api.md",
      kind: "markdown",
    },
    arquitetura_backend: {
      title: "Arquitetura — Backend (pasta backend/)",
      filePath: "docs/arquitetura_backend.md",
      kind: "markdown",
    },
    banco_de_dados: {
      title: "Banco de Dados — Tabelas e fluxos",
      filePath: "docs/banco_de_dados.md",
      kind: "markdown",
    },
    qase_mapa_mae: {
      title: "Qase — Mapa Mãe",
      filePath: "docs/qase_mapa_mae.md",
      kind: "markdown",
    },
    qase_etl: {
      title: "Qase — ETL (SQL)",
      filePath: "docs/qase_etl.sql",
      kind: "code",
      language: "sql",
    },
    kanban_import_export: {
      title: "Kanban Manual — Banco + Importação/Exportação",
      filePath: "docs/kanban_import_export.md",
      kind: "markdown",
    },
  };

async function readDoc(slug: string) {
  const entry = DOC_FILES[slug];
  if (!entry) return null;
  const absolute = path.join(process.cwd(), entry.filePath);
  const content = await fs.readFile(absolute, "utf8");
  return { ...entry, content };
}

export default async function DocsSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await readDoc(slug);
  if (!doc) notFound();

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10 space-y-4">
        <Breadcrumb items={[{ label: "Documentações", href: "/docs" }, { label: doc.title }]} />

        <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{doc.title}</h1>

          {doc.kind === "code" ? (
            <pre className="mt-4 overflow-x-auto rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f3f4f6) p-4 text-sm text-(--tc-text-primary,#0b1a3c)">
              <code>{doc.content}</code>
            </pre>
          ) : (
            <article className="mt-4 max-w-none text-(--tc-text-primary,#0b1a3c)">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children, ...props }) => (
                    <a
                      {...props}
                      href={href}
                      target={href?.startsWith("http") ? "_blank" : undefined}
                      rel={href?.startsWith("http") ? "noreferrer" : undefined}
                      className="text-(--tc-accent,#ef0001) hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  h1: ({ children, ...props }) => (
                    <h2 {...props} className="mt-6 text-2xl font-extrabold">
                      {children}
                    </h2>
                  ),
                  h2: ({ children, ...props }) => (
                    <h3 {...props} className="mt-5 text-xl font-bold">
                      {children}
                    </h3>
                  ),
                  h3: ({ children, ...props }) => (
                    <h4 {...props} className="mt-4 text-lg font-bold">
                      {children}
                    </h4>
                  ),
                  p: ({ children, ...props }) => (
                    <p {...props} className="mt-3 leading-7 text-(--tc-text-secondary,#334155)">
                      {children}
                    </p>
                  ),
                  code: ({ children, ...props }) => (
                    <code
                      {...props}
                      className="rounded bg-(--tc-surface-2,#f3f4f6) px-1 py-0.5 text-[0.95em]"
                    >
                      {children}
                    </code>
                  ),
                  pre: ({ children, ...props }) => (
                    <pre
                      {...props}
                      className="mt-4 overflow-x-auto rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f3f4f6) p-4 text-sm"
                    >
                      {children}
                    </pre>
                  ),
                  ul: ({ children, ...props }) => (
                    <ul {...props} className="mt-3 list-disc space-y-1 pl-6 text-(--tc-text-secondary,#334155)">
                      {children}
                    </ul>
                  ),
                  ol: ({ children, ...props }) => (
                    <ol {...props} className="mt-3 list-decimal space-y-1 pl-6 text-(--tc-text-secondary,#334155)">
                      {children}
                    </ol>
                  ),
                  blockquote: ({ children, ...props }) => (
                    <blockquote
                      {...props}
                      className="mt-4 border-l-4 border-(--tc-accent,#ef0001)/40 bg-(--tc-surface-2,#f3f4f6) px-4 py-3 text-(--tc-text-secondary,#334155)"
                    >
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {doc.content}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
