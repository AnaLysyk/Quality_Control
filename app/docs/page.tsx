import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";

const DOCS = [
  {
    slug: "arquitetura_front",
    title: "Arquitetura ??? Frontend (Next.js)",
    description: "Como o App Router, componentes e estilos est??o organizados.",
  },
  {
    slug: "arquitetura_api",
    title: "Arquitetura ??? API (app/api)",
    description: "Padr??es de rotas, autentica????o e integra????es (Qase, Postgres).",
  },
  {
    slug: "banco_de_dados",
    title: "Banco de Dados ??? Tabelas e fluxos",
    description: "Tabelas principais (User/Company/UserCompany) e pr??ticas de migra????o/seguran??a.",
  },
  {
    slug: "qase_mapa_mae",
    title: "Qase ??? Mapa M??e",
    description: "Guia/vis??o geral do mapeamento e fluxo Qase.",
  },
  {
    slug: "qase_etl",
    title: "Qase ??? ETL (SQL)",
    description: "Scripts SQL relacionados ao ETL do Qase.",
  },
  {
    slug: "kanban_import_export",
    title: "Kanban Manual ??? Importa????o/Exporta????o",
    description: "Como importar/exportar cart??es do Kanban manual.",
  },
] as const;

export default function DocsIndexPage() {
  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10 space-y-4">
        <Breadcrumb items={[{ label: "Documentações" }]} />

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">Documentações</h1>
          <p className="text-sm sm:text-base text-(--tc-text-secondary,#4b5563)">
            Materiais internos do projeto (renderizados direto do repositório).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {DOCS.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 transition hover:border-(--tc-accent,#ef0001)/50 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
            >
              <div className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{doc.title}</div>
              <div className="mt-1 text-sm text-(--tc-text-muted,#6b7280)">{doc.description}</div>
            </Link>
          ))}
        </div>

        <div className="text-sm text-(--tc-text-muted,#6b7280)">
          Dica: para docs por empresa, use “Documentações” no menu do perfil.
        </div>
      </div>
    </div>
  );
}
