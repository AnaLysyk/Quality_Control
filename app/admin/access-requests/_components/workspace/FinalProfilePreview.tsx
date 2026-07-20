import type { AccessRequestProfilePreview } from "../../_types/accessRequests.types";

type FinalProfilePreviewProps = Readonly<{
  profile: AccessRequestProfilePreview;
}>;

export function FinalProfilePreview({ profile }: FinalProfilePreviewProps) {
  const rows = [
    { label: "Nome completo", value: profile.fullName || profile.name || "Não informado" },
    { label: "Usuário", value: profile.username || "A definir" },
    { label: "E-mail", value: profile.email || "Não informado" },
    { label: "Telefone", value: profile.phone || "Não informado" },
    { label: "Empresa", value: profile.company || "Sem empresa" },
    { label: "Cargo", value: profile.jobRole || "Não informado" },
    { label: "Perfil de acesso", value: profile.accessType || "Não informado" },
    { label: "Senha", value: profile.passwordProvided ? "Senha informada" : "Senha pendente" },
  ];

  return (
    <section className="self-start rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Dados que serão salvos no perfil</p>
      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Cadastro final</h3>

      <div className="mt-5 divide-y divide-slate-100 rounded-[22px] border border-slate-200 bg-white">
        {rows.map((field) => (
          <div key={field.label} className="grid gap-2 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{field.label}</span>
            <span className="break-words text-sm font-black text-slate-950">{field.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
