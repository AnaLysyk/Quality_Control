import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { getClienteBySlug } from "@/lib/clienteServer";
import CompanyProfileClient from "./profileClient";

export default async function EmpresaHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const client = await getClienteBySlug(slug);
  if (!client) notFound();

  return (
    <div className="min-h-screen bg-(--tc-bg) text-(--tc-text-inverse)">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-10 py-8 space-y-6">
        <Breadcrumb
          items={[
            { label: "Empresas", href: "/empresas" },
            { label: client.name, href: `/empresas/${encodeURIComponent(client.slug)}/home`, title: client.name },
            { label: "Perfil" },
          ]}
        />

        <CompanyProfileClient clientId={client.id} clientSlug={client.slug} clientName={client.name} />
      </div>
    </div>
  );
}
