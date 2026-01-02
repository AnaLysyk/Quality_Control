"use client";

import { useState } from "react";

export type ClientFormValues = {
  name: string;
  taxId?: string;
  zip?: string;
  address?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  linkedin?: string;
  notes?: string;
  description?: string;
  active: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: ClientFormValues) => Promise<{ id: string } | null> | { id: string } | null | void;
  onOpenUser?: (clientId: string) => void;
  clientId?: string | null;
};

export function CreateClientModal({ open, onClose, onCreate, onOpenUser, clientId }: Props) {
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(clientId ?? null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return;
    setBusy(true);
    try {
      const result = await onCreate({
        name: name.trim(),
        taxId: taxId.trim() || undefined,
        zip: zip.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        notes: notes.trim() || undefined,
        description: description.trim() || undefined,
        active,
      });
      if (result === null || result === undefined) return;
      const newId = (result as any)?.id ?? createdClientId;
      setCreatedClientId(newId ?? null);
      setName("");
      setTaxId("");
      setZip("");
      setAddress("");
      setPhone("");
      setWebsite("");
      setLogoUrl("");
      setLogoFileName("");
      setLinkedin("");
      setNotes("");
      setDescription("");
      setActive(true);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl rounded-xl bg-white p-4 sm:p-6 shadow-2xl space-y-4 max-h-[calc(100vh-48px)] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-600">Empresa</p>
            <h3 className="text-xl font-semibold text-gray-900">Cadastrar empresa</h3>
            <p className="text-sm text-gray-600">Preencha os campos principais do cliente.</p>
          </div>
          <button type="button" className="text-lg text-gray-500" onClick={onClose} aria-label="Fechar modal">
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
          <label className="block text-sm">
            Nome / razao social
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Testing Company LTDA"
              required
            />
          </label>
          <label className="block text-sm">
            CNPJ / Tax ID
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            CEP
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="00000-000"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            Endereco
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, numero, cidade"
            />
          </label>
          <label className="block text-sm">
            Telefone
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </label>
          <label className="block text-sm">
            Website
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://exemplo.com"
            />
          </label>
          <label className="block text-sm">
            Logo URL
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://cdn.../logo.png"
            />
          </label>
          <label className="block text-sm">
            Upload de logo (placeholder)
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setLogoFileName(file?.name ?? "");
                // TODO: integrar com storage e definir URL
              }}
            />
            {logoFileName && <p className="mt-1 text-xs text-gray-500">Selecionado: {logoFileName}</p>}
          </label>
          <label className="block text-sm">
            LinkedIn da empresa
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://www.linkedin.com/company/..."
            />
          </label>
          <label className="block text-sm md:col-span-2">
            Descricao curta
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Resumo da empresa"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            Notas internas
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observacoes adicionais"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Status: {active ? "Ativo" : "Inativo"}
          </label>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <button
            type="button"
            className="rounded border border-gray-200 px-4 py-2 text-sm"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
          >
            Salvar empresa
          </button>
        </div>
      </form>
    </div>
  );
}
