import type {
  AccessRequestCommentView,
  AccessRequestComparisonRow,
  AccessRequestProfilePreview,
  AdjustmentFieldOptionView,
  AvatarChoice,
} from "./types";

type RejectionReasonOption = {
  value: string;
  label: string;
};

type AccessRequestProfileWorkspaceProps = {
  selected: AccessRequestProfilePreview;
  draft: Partial<AccessRequestProfilePreview>;
  comparisonRows: AccessRequestComparisonRow[];

  profileEmoji: string;
  saving: boolean;
  onAvatarChange: (choice: AvatarChoice) => void;

  missingRequiredFields: boolean;
  requiresCompany: boolean;
  acceptDisabled: boolean;
  accepting: boolean;
  requestingAdjustment: boolean;
  selectedIsPasswordReset: boolean;
  commentsLocked: boolean;

  comments: AccessRequestCommentView[];
  commentLoading: boolean;
  commentError: string | null;
  commentDraft: string;
  onCommentDraftChange: (value: string) => void;

  internalNotesDraft: string;
  onInternalNotesChange: (value: string) => void;
  onSaveInternalNotes: () => void;

  adjustmentFieldOptions: AdjustmentFieldOptionView[];
  adjustmentFieldsDraft: string[];
  adjustmentFieldComments: Record<string, string>;
  onToggleAdjustmentField: (field: string) => void;
  onAdjustmentFieldCommentChange: (field: string, value: string) => void;

  rejectionReasons: RejectionReasonOption[];
  rejectionReasonDraft: string;
  onRejectionReasonChange: (value: string) => void;

  onRequestAdjustment: () => void;
  onReject: () => void;
  onApprove: () => void;
};

const PROFILE_EMOJI_OPTIONS = ["👤", "🧑‍💻", "🧪", "🛡️", "🏢", "📊", "🚀", "⭐"] as const;

function safeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleString("pt-BR");
}

function statusLabel(status: string) {
  if (status === "closed") return "Aprovada";
  if (status === "rejected") return "Rejeitada";
  if (status === "in_progress") return "Aguardando ajuste";
  return "Aberta";
}

function statusTone(status: string) {
  if (status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function initials(value: string | null | undefined) {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return "QC";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${last}`.toUpperCase();
}

function displayName(profile: Pick<AccessRequestProfilePreview, "fullName" | "name" | "email">) {
  return profile.fullName || profile.name || profile.email || "(sem nome)";
}

function profileAvatar(profile: AccessRequestProfilePreview, fallbackEmoji: string) {
  return profile.visualProfile?.avatarValue || fallbackEmoji || initials(displayName(profile));
}

function buildPreviewProfile(
  selected: AccessRequestProfilePreview,
  draft: Partial<AccessRequestProfilePreview>,
): AccessRequestProfilePreview {
  return {
    ...selected,
    email: String(draft.email ?? selected.email ?? ""),
    fullName: String(draft.fullName ?? selected.fullName ?? ""),
    name: String(draft.name ?? selected.name ?? ""),
    username: typeof draft.username === "string" ? draft.username : selected.username,
    phone: String(draft.phone ?? selected.phone ?? ""),
    jobRole: String(draft.jobRole ?? selected.jobRole ?? ""),
    accessType: String(draft.accessType ?? selected.accessType ?? ""),
    company: String(draft.company ?? selected.company ?? ""),
    clientId: typeof draft.clientId === "string" ? draft.clientId : selected.clientId,
    title: String(draft.title ?? selected.title ?? ""),
    description: String(draft.description ?? selected.description ?? ""),
    notes: String(draft.notes ?? selected.notes ?? ""),
    adminNotes: typeof draft.adminNotes === "string" ? draft.adminNotes : selected.adminNotes,
    passwordProvided: draft.passwordProvided ?? selected.passwordProvided,
  };
}

function StatusOutcomeCard({
  status,
  accepting,
  requestingAdjustment,
}: {
  status: string;
  accepting: boolean;
  requestingAdjustment: boolean;
}) {
  if (accepting) {
    return (
      <section className="relative overflow-hidden rounded-[30px] border border-sky-200 bg-sky-50 p-5 text-sky-950 shadow-[0_18px_48px_rgba(14,165,233,0.12)]">
        <div className="absolute right-6 top-5 h-16 w-16 animate-pulse rounded-full bg-sky-200/70 blur-2xl" />
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">Processando decisão</p>
        <h3 className="mt-1 text-xl font-black">Validando solicitação...</h3>
        <p className="mt-2 text-sm leading-6 text-sky-800">Aguarde o retorno do sistema antes de fechar a tela.</p>
      </section>
    );
  }

  if (requestingAdjustment) {
    return (
      <section className="relative overflow-hidden rounded-[30px] border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-[0_18px_48px_rgba(217,119,6,0.12)]">
        <div className="absolute right-6 top-5 h-16 w-16 animate-pulse rounded-full bg-amber-200/70 blur-2xl" />
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">Solicitando ajuste</p>
        <h3 className="mt-1 text-xl font-black">Enviando retorno ao solicitante...</h3>
        <p className="mt-2 text-sm leading-6 text-amber-800">Os campos marcados serão liberados para correção.</p>
      </section>
    );
  }

  if (status === "closed") {
    return (
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-[0_18px_48px_rgba(5,150,105,0.12)]">
        <div className="absolute right-6 top-5 h-16 w-16 animate-pulse rounded-full bg-emerald-200/80 blur-2xl" />
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Pós-aprovação</p>
        <h3 className="mt-1 text-xl font-black">Acesso aprovado</h3>
        <p className="mt-2 text-sm leading-6 text-emerald-800">
          Perfil liberado no sistema. Valide o recebimento do e-mail de aprovação no fluxo de notificação.
        </p>
      </section>
    );
  }

  if (status === "rejected") {
    return (
      <section className="relative overflow-hidden rounded-[30px] border border-rose-200 bg-rose-50 p-5 text-rose-950 shadow-[0_18px_48px_rgba(225,29,72,0.12)]">
        <div className="absolute right-6 top-5 h-16 w-16 animate-pulse rounded-full bg-rose-200/80 blur-2xl" />
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-700">Pós-rejeição</p>
        <h3 className="mt-1 text-xl font-black">Solicitação recusada</h3>
        <p className="mt-2 text-sm leading-6 text-rose-800">
          A solicitação foi encerrada. O motivo/comentário deve ficar registrado para rastreabilidade.
        </p>
      </section>
    );
  }

  if (status === "in_progress") {
    return (
      <section className="relative overflow-hidden rounded-[30px] border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-[0_18px_48px_rgba(217,119,6,0.12)]">
        <div className="absolute right-6 top-5 h-16 w-16 animate-pulse rounded-full bg-amber-200/80 blur-2xl" />
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">Aguardando ajuste</p>
        <h3 className="mt-1 text-xl font-black">Solicitante precisa revisar dados</h3>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          Use a conversa e os campos para correção para acompanhar o retorno.
        </p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-sky-200 bg-sky-50 p-5 text-sky-950 shadow-[0_18px_48px_rgba(14,165,233,0.12)]">
      <div className="absolute right-6 top-5 h-16 w-16 animate-pulse rounded-full bg-sky-200/80 blur-2xl" />
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">Em análise</p>
      <h3 className="mt-1 text-xl font-black">Solicitação pronta para triagem</h3>
      <p className="mt-2 text-sm leading-6 text-sky-800">
        Revise a prévia do perfil, compare as alterações e conclua a decisão.
      </p>
    </section>
  );
}

function AvatarPicker({
  value,
  saving,
  onChange,
}: {
  value: string;
  saving: boolean;
  onChange: (choice: AvatarChoice) => void;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Visual do perfil</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">Opcional: emoji ou avatar padrão.</p>
        </div>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">
          {saving ? "Salvando" : "Editável"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PROFILE_EMOJI_OPTIONS.map((emoji) => {
          const active = value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange({ avatarKind: "emoji", avatarValue: emoji, avatarLabel: "Perfil do solicitante" })}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-xl transition ${
                active
                  ? "border-sky-300 bg-sky-50 shadow-[0_10px_24px_rgba(37,99,235,0.14)]"
                  : "border-slate-200 bg-white hover:-translate-y-0.5 hover:bg-slate-50"
              }`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileHero({
  profile,
  avatarValue,
  saving,
  onAvatarChange,
}: {
  profile: AccessRequestProfilePreview;
  avatarValue: string;
  saving: boolean;
  onAvatarChange: (choice: AvatarChoice) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.10)]">
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(239,0,1,0.13),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_45%,#eff6ff_100%)] p-6">
        <div className="pointer-events-none absolute right-8 top-6 h-28 w-28 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 h-24 w-24 rounded-full bg-rose-200/40 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-5 md:flex-row">
            <div className="flex shrink-0 flex-col items-center gap-3">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-[42px] border border-sky-100 bg-white text-7xl shadow-[0_28px_64px_rgba(37,99,235,0.18)]">
                {profileAvatar(profile, avatarValue)}
                <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border border-white bg-(--tc-primary) text-sm text-white shadow-[0_12px_24px_rgba(1,24,72,0.24)]">
                  ✎
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusTone(profile.status)}`}>
                  {statusLabel(profile.status)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                  {profile.accessType}
                </span>
              </div>

              <p className="mt-5 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">Prévia do perfil</p>
              <h2 className="mt-1 break-words text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {displayName(profile)}
              </h2>

              <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                <p className="truncate">E-mail: {profile.email || "Não informado"}</p>
                <p className="truncate">Telefone: {profile.phone || "Não informado"}</p>
                <p className="truncate">Usuário: @{profile.username || "a-definir"}</p>
                <p className="truncate">Cargo: {profile.jobRole || "Não informado"}</p>
                <p className="truncate">Empresa: {profile.company || "Sem empresa"}</p>
                <p className="truncate">Recebida: {safeDate(profile.createdAt)}</p>
              </div>

              <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600">
                Veja como este usuário ficará no sistema após a aprovação. O avatar é opcional e pode permanecer padrão.
              </p>
            </div>
          </div>

          <AvatarPicker value={avatarValue} saving={saving} onChange={onAvatarChange} />
        </div>
      </div>
    </section>
  );
}

function StatusBubbles({
  profile,
  missingRequiredFields,
  requiresCompany,
  changedCount,
  commentsLocked,
}: {
  profile: AccessRequestProfilePreview;
  missingRequiredFields: boolean;
  requiresCompany: boolean;
  changedCount: number;
  commentsLocked: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className={`rounded-[24px] border px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${
        profile.passwordProvided ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
      }`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${profile.passwordProvided ? "text-emerald-700" : "text-rose-700"}`}>
          Senha
        </p>
        <p className="mt-1 text-sm font-black text-slate-950">{profile.passwordProvided ? "Definida" : "Pendente"}</p>
      </div>

      <div className={`rounded-[24px] border px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${
        missingRequiredFields ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
      }`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${missingRequiredFields ? "text-amber-800" : "text-emerald-700"}`}>
          Obrigatórios
        </p>
        <p className="mt-1 text-sm font-black text-slate-950">{missingRequiredFields ? "Com pendências" : "OK"}</p>
      </div>

      <div className={`rounded-[24px] border px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${
        requiresCompany && !profile.clientId ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"
      }`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${requiresCompany && !profile.clientId ? "text-amber-800" : "text-sky-700"}`}>
          Empresa
        </p>
        <p className="mt-1 text-sm font-black text-slate-950">{requiresCompany && !profile.clientId ? "Obrigatória" : "Validada"}</p>
      </div>

      <div className={`rounded-[24px] border px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${
        commentsLocked ? "border-slate-200 bg-slate-50" : "border-violet-200 bg-violet-50"
      }`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${commentsLocked ? "text-slate-600" : "text-violet-700"}`}>
          Alterações
        </p>
        <p className="mt-1 text-sm font-black text-slate-950">{changedCount} campo(s)</p>
      </div>
    </div>
  );
}

function ChangesShowcase({ rows }: { rows: AccessRequestComparisonRow[] }) {
  const changed = rows.filter((row) => row.changed);

  return (
    <section className="rounded-[30px] border border-amber-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_46%,#eff6ff_100%)] p-5 shadow-[0_20px_54px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">Alterações do solicitante</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">O que mudou antes de virar perfil</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Cada card mostra o valor original e o valor atual que será usado na criação do usuário.
          </p>
        </div>

        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
          {changed.length} alteração(ões)
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {changed.length > 0 ? (
          changed.map((row) => (
            <article key={`visual-change-${row.label}`} className="overflow-hidden rounded-[24px] border border-amber-200 bg-white shadow-[0_16px_34px_rgba(217,119,6,0.10)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
                <h4 className="font-black text-slate-950">{row.label}</h4>
                <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                  Alterado
                </span>
              </div>

              <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-700">Antes</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-rose-900">{row.originalText}</p>
                </div>

                <div className="hidden items-center justify-center text-xl font-black text-slate-400 md:flex">→</div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 ring-2 ring-sky-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">Agora / perfil</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-black leading-6 text-sky-950">{row.currentText}</p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-5 text-emerald-800">
            <p className="font-black">Nenhuma alteração identificada.</p>
            <p className="mt-1 text-sm leading-6">Os dados atuais estão iguais ao envio original.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function FinalPreview({ profile }: { profile: AccessRequestProfilePreview }) {
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
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_54px_rgba(15,23,42,0.08)]">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">Dados que serão salvos no perfil</p>
        <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Cadastro final</h3>
      </div>

      <div className="mt-5 divide-y divide-slate-100 rounded-[24px] border border-slate-200 bg-white">
        {rows.map((field) => (
          <div key={field.label} className="grid gap-2 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{field.label}</span>
            <span className="break-words text-sm font-black text-slate-950">{field.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Conversation({
  comments,
  loading,
  error,
  locked,
  value,
  onChange,
}: {
  comments: AccessRequestCommentView[];
  loading: boolean;
  error: string | null;
  locked: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_54px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Conversa com o solicitante</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Linha do tempo e mensagens</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Histórico de retorno do solicitante. A decisão fica em painel separado.</p>
        </div>
        {loading ? <span className="text-sm font-medium text-slate-500">Carregando...</span> : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>
      ) : null}

      <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Nenhuma interação registrada ainda.</p>
          ) : (
            comments.map((comment) => {
              const mine = comment.authorRole === "leader_tc";
              return (
                <div key={comment.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-[22px] border px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)] ${
                    mine ? "border-sky-200 bg-sky-50 text-sky-950" : "border-slate-200 bg-white text-slate-950"
                  }`}>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {mine ? "Admin" : "Solicitante"} · {comment.authorName}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">{safeDate(comment.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <textarea
          className="mt-4 w-full resize-none rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.10)] disabled:bg-slate-100"
          rows={4}
          placeholder={locked ? "Solicitação finalizada - conversa bloqueada" : "Mensagem para o solicitante ou observação da conversa"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={locked}
        />
      </div>
    </section>
  );
}

function DecisionPanel({
  passwordProvided,
  requiresCompany,
  hasCompany,
  accepting,
  requestingAdjustment,
  commentsLocked,
  acceptDisabled,
  selectedIsPasswordReset,
  adjustmentFieldCount,
  commentDraft,
  rejectionReasonDraft,
  rejectionReasons,
  onRejectionReasonChange,
  onRequestAdjustment,
  onReject,
  onApprove,
}: {
  passwordProvided: boolean;
  requiresCompany: boolean;
  hasCompany: boolean;
  accepting: boolean;
  requestingAdjustment: boolean;
  commentsLocked: boolean;
  acceptDisabled: boolean;
  selectedIsPasswordReset: boolean;
  adjustmentFieldCount: number;
  commentDraft: string;
  rejectionReasonDraft: string;
  rejectionReasons: RejectionReasonOption[];
  onRejectionReasonChange: (value: string) => void;
  onRequestAdjustment: () => void;
  onReject: () => void;
  onApprove: () => void;
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Decisão da solicitação</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Concluir análise do perfil</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Aprove o acesso, solicite ajuste ou recuse informando motivo/comentário.</p>
        </div>

        <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${
          acceptDisabled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {acceptDisabled ? "Com pendências" : "Pronto para aprovar"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${
          passwordProvided ? "border border-emerald-300 bg-emerald-100 text-emerald-800" : "border border-rose-300 bg-rose-100 text-rose-800"
        }`}>
          {passwordProvided ? "Senha válida" : "Senha ausente"}
        </span>

        {requiresCompany && !hasCompany ? (
          <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">
            Empresa obrigatória
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid w-full gap-3 lg:grid-cols-[minmax(220px,0.7fr)_auto_auto_auto] lg:items-center">
        <select
          value={rejectionReasonDraft}
          onChange={(event) => onRejectionReasonChange(event.target.value)}
          disabled={commentsLocked}
          className="min-h-12 rounded-[18px] border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 disabled:opacity-60"
          data-testid="access-request-rejection-reason"
          aria-label="Motivo da rejeição"
        >
          <option value="">Motivo da rejeição</option>
          {rejectionReasons.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onRequestAdjustment}
          disabled={requestingAdjustment || selectedIsPasswordReset || !commentDraft.trim() || commentsLocked || adjustmentFieldCount === 0}
          className="rounded-[18px] border border-amber-300 bg-amber-50 px-5 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {requestingAdjustment ? "Enviando..." : "Solicitar ajuste"}
        </button>

        <button
          type="button"
          onClick={onReject}
          aria-label="Recusar solicitação"
          disabled={accepting || commentsLocked || (!rejectionReasonDraft && !commentDraft.trim())}
          className="rounded-[18px] border border-rose-300 bg-rose-50 px-5 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {accepting ? "Processando..." : "Recusar"}
        </button>

        <button
          type="button"
          onClick={onApprove}
          aria-label="Aprovar solicitação"
          disabled={acceptDisabled}
          className="rounded-[18px] bg-(--tc-primary) px-7 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_38px_rgba(1,24,72,0.26)] transition hover:-translate-y-0.5 hover:bg-[rgba(1,24,72,0.88)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {accepting ? "Aprovando..." : selectedIsPasswordReset ? "Aprovar reset" : "Aprovar acesso"}
        </button>
      </div>
    </section>
  );
}

export function AccessRequestProfileWorkspace({
  selected,
  draft,
  comparisonRows,
  profileEmoji,
  saving,
  onAvatarChange,
  missingRequiredFields,
  requiresCompany,
  acceptDisabled,
  accepting,
  requestingAdjustment,
  selectedIsPasswordReset,
  commentsLocked,
  comments,
  commentLoading,
  commentError,
  commentDraft,
  onCommentDraftChange,
  internalNotesDraft,
  onInternalNotesChange,
  onSaveInternalNotes,
  adjustmentFieldOptions,
  adjustmentFieldsDraft,
  adjustmentFieldComments,
  onToggleAdjustmentField,
  onAdjustmentFieldCommentChange,
  rejectionReasons,
  rejectionReasonDraft,
  onRejectionReasonChange,
  onRequestAdjustment,
  onReject,
  onApprove,
}: AccessRequestProfileWorkspaceProps) {
  const previewProfile = buildPreviewProfile(selected, draft);
  const changedCount = comparisonRows.filter((row) => row.changed).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(239,0,1,0.07),transparent_28%),radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_30%)] p-3 [scrollbar-width:none] sm:p-4 xl:p-5 2xl:p-6 [&::-webkit-scrollbar]:hidden">
      <ProfileHero profile={previewProfile} avatarValue={profileEmoji} saving={saving} onAvatarChange={onAvatarChange} />

      <StatusBubbles
        profile={previewProfile}
        missingRequiredFields={missingRequiredFields}
        requiresCompany={requiresCompany}
        changedCount={changedCount}
        commentsLocked={commentsLocked}
      />

      <StatusOutcomeCard status={selected.status} accepting={accepting} requestingAdjustment={requestingAdjustment} />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.78fr)]">
        <ChangesShowcase rows={comparisonRows} />
        <FinalPreview profile={previewProfile} />
      </div>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_54px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Observações internas</p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Notas da análise</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Informação visível apenas para administradores/revisores. Não será enviada ao solicitante.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">Interno</span>
        </div>

        <textarea
          value={internalNotesDraft}
          onChange={(event) => onInternalNotesChange(event.target.value)}
          onBlur={onSaveInternalNotes}
          placeholder="Registre contexto, validação do gestor, motivo da decisão ou ressalvas internas..."
          rows={4}
          className="mt-4 w-full resize-none rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.10)]"
        />
      </section>

      <Conversation
        comments={comments}
        loading={commentLoading}
        error={commentError}
        locked={commentsLocked}
        value={commentDraft}
        onChange={onCommentDraftChange}
      />

      {!commentsLocked ? (
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_54px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Campos para correção</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Liberar ajuste ao solicitante</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Marque os campos que poderão ser corrigidos.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
              {adjustmentFieldsDraft.length} campo(s)
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {adjustmentFieldOptions.map((option) => {
              const selectedField = adjustmentFieldsDraft.includes(option.field);
              return (
                <button
                  key={`adjustment-field-${option.field}`}
                  type="button"
                  onClick={() => onToggleAdjustmentField(option.field)}
                  className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-black transition ${
                    selectedField
                      ? "border-rose-300 bg-rose-50 text-rose-700 shadow-[0_8px_18px_rgba(225,29,72,0.1)]"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[rgba(239,0,1,0.28)] hover:text-slate-950"
                  }`}
                  title={option.hint}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {adjustmentFieldsDraft.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {adjustmentFieldsDraft.map((field) => {
                const option = adjustmentFieldOptions.find((item) => item.field === field);
                return (
                  <label key={`adjustment-comment-${field}`} className="text-xs font-black text-slate-600">
                    Observação para {option?.label ?? field}
                    <input
                      type="text"
                      value={adjustmentFieldComments[field] ?? ""}
                      onChange={(event) => onAdjustmentFieldCommentChange(field, event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                      data-testid={`access-request-adjustment-comment-${field}`}
                    />
                  </label>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      <DecisionPanel
        passwordProvided={Boolean(previewProfile.passwordProvided)}
        requiresCompany={requiresCompany}
        hasCompany={Boolean(previewProfile.clientId)}
        accepting={accepting}
        requestingAdjustment={requestingAdjustment}
        commentsLocked={commentsLocked}
        acceptDisabled={acceptDisabled}
        selectedIsPasswordReset={selectedIsPasswordReset}
        adjustmentFieldCount={adjustmentFieldsDraft.length}
        commentDraft={commentDraft}
        rejectionReasonDraft={rejectionReasonDraft}
        rejectionReasons={rejectionReasons}
        onRejectionReasonChange={onRejectionReasonChange}
        onRequestAdjustment={onRequestAdjustment}
        onReject={onReject}
        onApprove={onApprove}
      />
    </div>
  );
}
