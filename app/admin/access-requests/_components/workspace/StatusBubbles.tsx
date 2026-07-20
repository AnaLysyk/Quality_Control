import type { AccessRequestProfilePreview } from "../../_types/accessRequests.types";

type StatusBubblesProps = Readonly<{
  profile: AccessRequestProfilePreview;
  missingRequiredFields: boolean;
  requiresCompany: boolean;
  changedCount: number;
  commentsLocked: boolean;
}>;

type ValidationItemProps = Readonly<{
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
}>;

function toneDotClass(tone: ValidationItemProps["tone"]) {
  if (tone === "ok") return "bg-emerald-500";
  if (tone === "warn") return "bg-amber-500";
  return "bg-slate-400";
}

function changesTone(commentsLocked: boolean, changedCount: number): ValidationItemProps["tone"] {
  if (commentsLocked) return "neutral";
  if (changedCount > 0) return "warn";
  return "neutral";
}

function ValidationItem({ label, value, tone }: ValidationItemProps) {
  const dotClass = toneDotClass(tone);

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
          label="Obrigatórios"
          value={missingRequiredFields ? "Pendentes" : "OK"}
          tone={missingRequiredFields ? "warn" : "ok"}
        />
        <ValidationItem
          label="Empresa"
          value={companyPending ? "Obrigatória" : "Validada"}
          tone={companyPending ? "warn" : "ok"}
        />
        <ValidationItem
          label="Alterações"
          value={`${changedCount} campo(s)`}
          tone={changesTone(commentsLocked, changedCount)}
        />
      </div>
    </section>
  );
}
