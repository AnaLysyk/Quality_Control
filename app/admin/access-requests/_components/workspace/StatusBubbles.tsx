import type { AccessRequestProfilePreview } from "../../_types/accessRequests.types";

type StatusBubblesProps = {
  profile: AccessRequestProfilePreview;
  missingRequiredFields: boolean;
  requiresCompany: boolean;
  changedCount: number;
  commentsLocked: boolean;
};

function ValidationItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const dotClass =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
        ? "bg-amber-500"
        : "bg-slate-400";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <span className="truncate text-sm font-semibold text-slate-700">{value}</span>
    </div>
  );
}

export function StatusBubbles({
  profile,
  missingRequiredFields,
  requiresCompany,
  changedCount,
  commentsLocked,
}: StatusBubblesProps) {
  const companyPending = requiresCompany && !profile.clientId;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <ValidationItem
          label="Senha"
          value={profile.passwordProvided ? "Definida" : "Pendente"}
          tone={profile.passwordProvided ? "ok" : "warn"}
        />
        <ValidationItem
          label="ObrigatÃ³rios"
          value={missingRequiredFields ? "Pendentes" : "OK"}
          tone={missingRequiredFields ? "warn" : "ok"}
        />
        <ValidationItem
          label="Empresa"
          value={companyPending ? "ObrigatÃ³ria" : "Validada"}
          tone={companyPending ? "warn" : "ok"}
        />
        <ValidationItem
          label="AlteraÃ§Ãµes"
          value={`${changedCount} campo(s)`}
          tone={commentsLocked ? "neutral" : changedCount > 0 ? "warn" : "neutral"}
        />
      </div>
    </section>
  );
}

