"use client";

import { TeamList } from "./TeamList";

type Client = {
  id: string;
  name: string;
  taxId?: string | null;
  zip?: string | null;
  address?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  docsLink?: string | null;
  linkedin?: string | null;
  notes?: string | null;
  active: boolean;
  team: { id: string; name: string; role: string; avatarUrl?: string | null }[];
};

type Props = {
  client: Client | null;
  isGlobalAdmin: boolean;
  onOpenCreateUser: () => void;
  onEditClient?: () => void;
};

export function ClientDetails({ client, isGlobalAdmin, onOpenCreateUser, onEditClient }: Props) {
  if (!client) {
    return <p className="text-sm text-gray-600">Selecione um cliente para ver detalhes.</p>;
  }

  const infoFields = [
    { label: "CNPJ", value: client.taxId ?? "Nao informado" },
    { label: "CEP", value: client.zip ?? "Nao informado" },
    { label: "Endereco", value: client.address ?? "Nao informado" },
    { label: "Website", value: client.website ?? "Nao informado", isLink: true },
    { label: "Telefone", value: client.phone ?? "Nao informado" },
    { label: "Documentacao", value: client.docsLink ?? "Nao informado", isLink: true },
    { label: "LinkedIn", value: client.linkedin ?? "Nao informado", isLink: true },
    { label: "Descricao", value: client.description ?? "Sem descricao", full: true },
    { label: "Notas internas", value: client.notes ?? "Sem notas", full: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
          <p className="text-xs text-gray-500">{client.active ? "Ativo" : "Inativo"}</p>
        </div>
        {isGlobalAdmin && (
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            onClick={onEditClient}
          >
            Editar cliente
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Informacoes gerais</h3>
          {isGlobalAdmin && (
            <button
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-300"
              onClick={onOpenCreateUser}
            >
              + Cadastrar usuario
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
          <Field label="Nome" value={client.name} />
          {infoFields.map((f) => (
            <Field key={f.label} label={f.label} value={f.value as string} isLink={f.isLink} full={f.full} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Equipe</h3>
          {isGlobalAdmin && (
            <button
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-300"
              onClick={onOpenCreateUser}
            >
              + Criar usuario
            </button>
          )}
        </div>
        <TeamList members={client.team} />
      </div>
    </div>
  );
}

function Field({ label, value, isLink, full }: { label: string; value: string; isLink?: boolean; full?: boolean }) {
  const display = value ?? "Nao informado";
  const trimmed = display.trim();
  const isPlaceholder =
    display === "Nao informado" || display === "Sem notas" || display === "Sem descricao";
  const isUrl = isLink && /^https?:\/\//i.test(trimmed);
  const content = isUrl ? (
    <a href={trimmed} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all">
      {display}
    </a>
  ) : (
    <span className={`font-medium wrap-break-word ${isPlaceholder ? "text-gray-400" : ""}`}>{display}</span>
  );

  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <p className="text-xs uppercase text-gray-500">{label}</p>
      {content}
    </div>
  );
}
