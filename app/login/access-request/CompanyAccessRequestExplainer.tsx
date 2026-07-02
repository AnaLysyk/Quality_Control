"use client";

import { FiCheckCircle, FiInfo, FiLink2 } from "react-icons/fi";

export type CompanyAccessRequestExplainerProps = {
  isCompanyProfile: boolean;
  companyName?: string | null;
  companyTaxId?: string | null;
};

function valueOrFallback(value?: string | null, fallback = "A preencher") {
  const normalized = value?.trim();
  return normalized || fallback;
}

export function CompanyAccessRequestExplainer({ isCompanyProfile, companyName, companyTaxId }: CompanyAccessRequestExplainerProps) {
  if (!isCompanyProfile) return null;

  return (
    <section className="rounded-2xl border border-sky-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-4 text-[#011848] shadow-[0_14px_32px_rgba(1,24,72,0.08)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
          <FiInfo className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-700">Solicitação de criação de empresa</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-[#011848]">Esse perfil cria uma empresa para aprovação</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#33456f]">
            Ao enviar, a solicitação entra para análise. Qase não é obrigatório nesse primeiro pedido; o administrador pode completar token, projetos e aplicações depois no modal de empresa.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-sky-200 bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-600">Empresa</p>
              <p className="mt-1 truncate text-sm font-black text-[#011848]">{valueOrFallback(companyName, "Nome da empresa")}</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-600">CNPJ</p>
              <p className="mt-1 truncate text-sm font-black text-[#011848]">{valueOrFallback(companyTaxId, "Opcional até aprovação")}</p>
            </div>
          </div>

          <ul className="mt-3 space-y-1 text-xs font-semibold leading-5 text-[#33456f]">
            <li className="flex gap-2"><FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> O pedido deve preservar dados cadastrais da empresa.</li>
            <li className="flex gap-2"><FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Após aprovação, o admin completa usuário institucional, logo, Qase e aplicações.</li>
            <li className="flex gap-2"><FiLink2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /> A criação final deve seguir o mesmo contrato do modal de empresas.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

