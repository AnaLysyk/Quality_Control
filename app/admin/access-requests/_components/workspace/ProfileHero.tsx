import { useState } from "react";
import { FiEdit3, FiUser } from "react-icons/fi";
import { AvatarLibraryDialog } from "@/components/AvatarLibraryDialog";
import type { AccessRequestProfilePreview, AvatarChoice } from "../../_types/accessRequests.types";
import { displayName, safeDate, statusLabel, statusTone } from "./workspace.helpers";

type ProfileHeroProps = {
  profile: AccessRequestProfilePreview;
  avatarValue: string;
  avatarKind?: AvatarChoice["avatarKind"];
  saving: boolean;
  readOnly?: boolean;
  onSaveVisual?: () => void;
  onAvatarChange: (choice: AvatarChoice) => void;
};

function isVisualImage(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/");
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
        <span className="block translate-y-[1px] text-3xl leading-none">{value}</span>
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
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

export function ProfileHero({ profile, avatarValue, avatarKind, saving, readOnly = false, onSaveVisual, onAvatarChange }: ProfileHeroProps) {
  const [avatarLibraryOpen, setAvatarLibraryOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="relative h-18 w-18 shrink-0">
            <div className="h-full w-full overflow-hidden rounded-full border border-slate-200 bg-white">
              <AvatarPreview profile={profile} avatarValue={avatarValue} avatarKind={avatarKind} />
            </div>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => setAvatarLibraryOpen(true)}
                className="absolute -right-1.5 -top-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-slate-950 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
                aria-label="Alterar avatar"
                title="Alterar avatar"
              >
                <FiEdit3 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusTone(profile.status)}`}>
                {statusLabel(profile.status)}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Recebida em {safeDate(profile.createdAt)}
              </span>
            </div>

            <h2 className="mt-2 break-words text-2xl font-black tracking-tight text-slate-950">
              {displayName(profile)}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {profile.accessType || "Perfil não informado"} · {profile.jobRole || "Cargo não informado"}
            </p>
          </div>
        </div>

        {!readOnly ? (
          <button
            type="button"
            onClick={onSaveVisual}
            disabled={saving || !onSaveVisual}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar visual"}
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="E-mail" value={profile.email || "Não informado"} />
        <DetailItem label="Telefone" value={profile.phone || "Não informado"} />
        <DetailItem label="Usuário" value={profile.username ? `@${profile.username}` : "A definir"} />
        <DetailItem label="Empresa" value={profile.company || "Sem empresa"} />
      </div>

      {!readOnly ? (
        <AvatarLibraryDialog
          open={avatarLibraryOpen}
          onOpenChange={setAvatarLibraryOpen}
          value={avatarValue}
          kind={avatarKind ?? profile.visualProfile?.avatarKind ?? "default"}
          onSelect={(choice) => onAvatarChange(choice)}
        />
      ) : null}
    </section>
  );
}
