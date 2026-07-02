import { useEffect, useMemo, useState } from "react";
import { FiClock, FiEdit3, FiExternalLink, FiSave, FiTrash2, FiUser } from "react-icons/fi";
import { AvatarLibraryDialog } from "@/components/AvatarLibraryDialog";
import type { AccessRequestProfilePreview, AvatarChoice } from "../../_types/accessRequests.types";
import { displayName, safeDate, statusLabel } from "./workspace.helpers";

export type ProfileTimelineItem = {
  id: string;
  title: string;
  side: string;
  date: string;
  summary: string;
  details: string;
  tone?: "ok" | "warn" | "danger" | "neutral";
};

type ProfileHeroProps = {
  profile: AccessRequestProfilePreview;
  avatarValue: string;
  avatarKind?: AvatarChoice["avatarKind"];
  saving: boolean;
  readOnly?: boolean;
  onSaveVisual?: () => void;
  onAvatarChange: (choice: AvatarChoice) => void;
  internalNotesValue?: string;
  notesLocked?: boolean;
  onInternalNotesChange?: (value: string) => void;
  onSaveInternalNotes?: (value: string) => void;
  timelineItems?: ProfileTimelineItem[];
};

const INTERNAL_NOTES_LIMIT = 1200;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isVisualImage(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/");
}

function statusDotClass(status: string) {
  if (status === "closed") return "bg-emerald-500 shadow-emerald-300";
  if (status === "rejected") return "bg-rose-500 shadow-rose-300";
  if (status === "in_progress") return "bg-amber-500 shadow-amber-300";
  return "bg-sky-500 shadow-sky-300";
}

function statusBadgeClass(status: string) {
  if (status === "closed") return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (status === "rejected") return "border-rose-300 bg-rose-100 text-rose-800";
  if (status === "in_progress") return "border-amber-300 bg-amber-100 text-amber-900";
  return "border-sky-300 bg-sky-100 text-sky-800";
}

function toneClass(tone: ProfileTimelineItem["tone"]) {
  if (tone === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function normalizeAccessLabel(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildManagementTarget(profile: AccessRequestProfilePreview) {
  if (profile.status !== "closed" && profile.status !== "approved") return null;

  const accessType = normalizeAccessLabel(profile.accessType);
  const userQuery = encodeURIComponent(profile.email || profile.username || displayName(profile));
  const companyQuery = encodeURIComponent(profile.company || profile.email || displayName(profile));

  if (accessType === "empresa") {
    return {
      href: `/admin/clients?q=${companyQuery}`,
      label: "Abrir em Empresas",
    };
  }

  if (accessType.includes("suporte")) {
    return {
      href: `/admin/users?tab=support&q=${userQuery}`,
      label: "Abrir em Usuários",
    };
  }

  if (accessType.includes("lider")) {
    return {
      href: `/admin/users?tab=admin&q=${userQuery}`,
      label: "Abrir em Usuários",
    };
  }

  if (accessType.includes("tc")) {
    return {
      href: `/admin/users?tab=testing&q=${userQuery}`,
      label: "Abrir em Usuários",
    };
  }

  return {
    href: `/admin/users?tab=company&q=${userQuery}`,
    label: "Abrir em Usuários",
  };
}

function AvatarPreview({
  profile,
  avatarValue,
  avatarKind,
}: {
  profile: AccessRequestProfilePreview;
  avatarValue: string;
  avatarKind?: AvatarChoice["avatarKind"];
}) {
  const [broken, setBroken] = useState(false);
  const kind = avatarKind ?? profile.visualProfile?.avatarKind ?? "default";
  const value = avatarValue || profile.visualProfile?.avatarValue || "";

  if ((kind === "gif" || kind === "image") && isVisualImage(value) && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={value}
        alt={profile.visualProfile?.avatarLabel || "Imagem do perfil"}
        className="h-full w-full rounded-full object-cover object-center"
        onError={() => setBroken(true)}
      />
    );
  }

  if (kind === "emoji" && value) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-50">
        <span className="block translate-y-px text-3xl leading-none">{value}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-50 text-slate-500">
      <FiUser className="h-7 w-7" aria-hidden="true" />
      <span className="sr-only">Sem foto</span>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

export function ProfileHero({
  profile,
  avatarValue,
  avatarKind,
  saving,
  readOnly = false,
  onSaveVisual,
  onAvatarChange,
  internalNotesValue,
  notesLocked = false,
  onInternalNotesChange,
  onSaveInternalNotes,
  timelineItems = [],
}: ProfileHeroProps) {
  const [avatarLibraryOpen, setAvatarLibraryOpen] = useState(false);
  const [visualDirty, setVisualDirty] = useState(false);
  const [noteEditing, setNoteEditing] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);

  const resolvedNote =
    internalNotesValue && internalNotesValue.trim().length > 0
      ? internalNotesValue
      : profile.adminNotes || profile.reviewSummary?.internalNotes || "";

  const [noteDraft, setNoteDraft] = useState(resolvedNote);

  useEffect(() => {
    setNoteDraft(resolvedNote);
  }, [resolvedNote, profile.id]);

  const noteDirty = noteDraft !== resolvedNote;
  const canEditNote = !readOnly && !notesLocked && Boolean(onInternalNotesChange && onSaveInternalNotes);
  const noteText = resolvedNote.trim();
  const managementTarget = buildManagementTarget(profile);

  function saveNote() {
    const value = noteDraft.slice(0, INTERNAL_NOTES_LIMIT);
    onInternalNotesChange?.(value);
    onSaveInternalNotes?.(value);
    setNoteEditing(false);
  }

  function removeNote() {
    setNoteDraft("");
    onInternalNotesChange?.("");
    onSaveInternalNotes?.("");
    setNoteEditing(false);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <div className="h-full w-full overflow-hidden rounded-full border border-slate-200 bg-white">
              <AvatarPreview profile={profile} avatarValue={avatarValue} avatarKind={avatarKind} />
            </div>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => setAvatarLibraryOpen(true)}
                className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-slate-950 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
                aria-label="Alterar avatar"
                title="Alterar avatar"
              >
                <FiEdit3 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Recebida em {safeDate(profile.createdAt)}</span>
            </div>

            <h2 className="mt-1 wrap-break-word text-2xl font-black tracking-tight text-slate-950">
              {displayName(profile)}
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-700">
              {profile.accessType || "Perfil não informado"} · {profile.jobRole || "Cargo não informado"}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={classNames("relative inline-flex h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px]", statusDotClass(profile.status))}>
                <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-25" />
              </span>

              <span
                className={classNames(
                  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em]",
                  statusBadgeClass(profile.status),
                )}
              >
                {statusLabel(profile.status)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {managementTarget ? (
            <a
              href={managementTarget.href}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-[0.12em] text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <FiExternalLink className="h-4 w-4" />
              {managementTarget.label}
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => setTimelineOpen((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Abrir histórico da solicitação"
            title="Histórico da solicitação"
          >
            <FiClock className="h-4 w-4" />
          </button>

          {visualDirty && !readOnly ? (
            <button
              type="button"
              onClick={() => {
                onSaveVisual?.();
                setVisualDirty(false);
              }}
              disabled={saving || !onSaveVisual}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSave />
              Salvar visual
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="E-mail" value={profile.email || "Não informado"} />
        <DetailItem label="Telefone" value={profile.phone || "Não informado"} />
        <DetailItem label="Usuário" value={profile.username ? "@" + profile.username : "A definir"} />
        <DetailItem label="Empresa" value={profile.company || "Sem empresa"} />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Observação interna</p>

            {noteEditing ? (
              <textarea
                value={noteDraft}
                maxLength={INTERNAL_NOTES_LIMIT}
                onChange={(event) => setNoteDraft(event.target.value.slice(0, INTERNAL_NOTES_LIMIT))}
                rows={3}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                placeholder="Adicionar uma observação interna para este perfil..."
              />
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-900">
                {noteText || "Sem observação interna."}
              </p>
            )}
          </div>

          {!readOnly ? (
            <div className="flex shrink-0 items-center gap-1">
              {noteEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setNoteDraft(resolvedNote);
                      setNoteEditing(false);
                    }}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveNote}
                    disabled={!canEditNote || (!noteDirty && noteDraft.trim() === noteText)}
                    className="h-9 rounded-xl bg-slate-950 px-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setNoteEditing(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                    aria-label="Editar nota"
                    title="Editar nota"
                  >
                    <FiEdit3 />
                  </button>
                  {noteText ? (
                    <button
                      type="button"
                      onClick={removeNote}
                      disabled={!canEditNote}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      aria-label="Remover nota"
                      title="Remover nota"
                    >
                      <FiTrash2 />
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {timelineOpen ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <FiClock className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-black text-slate-950">Linha do tempo</p>
          </div>

          <div className="mt-3 grid gap-2">
            {timelineItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                Nenhuma movimentação registrada.
              </p>
            ) : (
              timelineItems.map((item) => {
                const expanded = expandedTimelineId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExpandedTimelineId(expanded ? null : item.id)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-950">{item.title}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                          {item.side} · {item.summary}
                        </p>
                      </div>
                      <span className={classNames("rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]", toneClass(item.tone))}>
                        {item.date}
                      </span>
                    </div>

                    {expanded ? (
                      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-700">
                        {item.details}
                      </p>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <AvatarLibraryDialog
          open={avatarLibraryOpen}
          onOpenChange={setAvatarLibraryOpen}
          value={avatarValue}
          kind={avatarKind ?? profile.visualProfile?.avatarKind ?? "default"}
          onSelect={(choice) => {
            onAvatarChange(choice);
            setVisualDirty(true);
          }}
        />
      ) : null}
    </section>
  );
}

