"use client";

import { useMemo, useState } from "react";
import { ClientSearchBar } from "./components/ClientSearchBar";
import { ClientList } from "./components/ClientList";
import { ClientDetails } from "./components/ClientDetails";
import { CreateUserModal } from "./components/CreateUserModal";
import { CreateClientModal, type ClientFormValues } from "./components/CreateClientModal";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
};

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
  team: TeamMember[];
};

const initialClients: Client[] = [
  {
    id: "1",
    name: "Griaule",
    taxId: "00.000.000/0000-00",
    address: "Rua Exemplo, 123",
    zip: "00000-000",
    description: "Solucao de biometria",
    website: "https://www.griaule.com",
    phone: "+55 11 99999-9999",
    logoUrl: null,
    docsLink: "https://docs.exemplo.com",
    linkedin: "https://www.linkedin.com/company/exemplo",
    notes: "Exemplo local sem backend",
    active: true,
    team: [{ id: "1", name: "Ana", role: "Analista de Testes", avatarUrl: null }],
  },
];

export default function ClientsPage() {
  // mock de permissoes: troque para true para simular admin
  const [isGlobalAdmin] = useState(false);

  const [clients, setClients] = useState<Client[]>(initialClients);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(clients[0]?.id ?? null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);

  const visibleClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(term));
  }, [clients, search]);

  const selected = useMemo(() => clients.find((c) => c.id === selectedId) ?? null, [clients, selectedId]);

  function handleCreateUser(data: { name: string; email: string; role: "USER" | "ADMIN" }) {
    if (!selected) return;
    const newMember: TeamMember = {
      id: crypto.randomUUID(),
      name: data.name,
      role: data.role === "ADMIN" ? "Admin" : "Analista de Testes",
      avatarUrl: null,
    };
    setClients((prev) => prev.map((c) => (c.id === selected.id ? { ...c, team: [...c.team, newMember] } : c)));
  }

  function handleCreateClient(data: ClientFormValues) {
    const newClient: Client = {
      id: crypto.randomUUID(),
      name: data.name,
      taxId: data.taxId ?? null,
      zip: data.zip ?? null,
      address: data.address ?? null,
      description: data.description ?? null,
      website: data.website ?? null,
      phone: data.phone ?? null,
      logoUrl: data.logoUrl ?? null,
      docsLink: data.linkedin ?? null,
      linkedin: data.linkedin ?? null,
      notes: data.notes ?? null,
      active: data.active,
      team: [],
    };
    setClients((prev) => [newClient, ...prev]);
    setSelectedId(newClient.id);
    return { id: newClient.id };
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1533] via-[#0f1f4b] to-[#0a1533] px-6 py-8 text-[#0b1a3c]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between text-white">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-200">Gestao</p>
            <h1 className="text-3xl font-bold">Clientes</h1>
          </div>
          {isGlobalAdmin && (
            <button
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400"
              onClick={() => setCreateClientOpen(true)}
            >
              + Cadastrar instituicao ou empresa
            </button>
          )}
        </header>

        <div className="rounded-xl bg-white/95 p-5 shadow-xl backdrop-blur">
          <ClientSearchBar value={search} onChange={setSearch} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_2fr]">
            <div>
              <ClientList items={visibleClients} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <ClientDetails
                client={selected}
                isGlobalAdmin={isGlobalAdmin}
                onOpenCreateUser={() => setCreateUserOpen(true)}
                onEditClient={() => setCreateClientOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <CreateUserModal open={createUserOpen} onClose={() => setCreateUserOpen(false)} onCreate={handleCreateUser} />
      <CreateClientModal
        open={createClientOpen}
        onClose={() => setCreateClientOpen(false)}
        onCreate={handleCreateClient}
        onOpenUser={() => setCreateUserOpen(true)}
      />
    </div>
  );
}
