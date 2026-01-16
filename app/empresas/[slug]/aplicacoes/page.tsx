"use client";

import { useParams } from "next/navigation";
import { ApplicationsList } from "@/applications-hub/ApplicationsList";
import Breadcrumb from "@/components/Breadcrumb";

export default function EmpresaAplicacoesPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "empresa";

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: "Empresas", href: "/empresas" },
              {
                label: slug,
                href: `/empresas/${encodeURIComponent(slug)}/home`,
                title: slug,
              },
              { label: "Aplicações" },
            ]}
          />

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
            Aplicações da empresa
          </h1>
          <p className="text-sm sm:text-base text-(--tc-text-secondary,#4b5563)">
            Listagem de aplicações no contexto da empresa.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:mt-6 sm:px-6 lg:px-10">
        <ApplicationsList />
      </div>
    </div>
  );
}
