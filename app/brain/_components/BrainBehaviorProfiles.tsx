"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type BehaviorProfile = {
  id: string;
  name: string;
  description?: string | null;
  instructions: string;
  tone?: string | null;
  formality?: string | null;
  responseLength?: string | null;
  scopeType: string;
  isSystem: boolean;
  status: string;
};

type Surface = "home" | "chat" | "summary" | "report" | "audio";

const SURFACES: Array<{ value: Surface; label: string }> = [
  { value: "home", label: "Brain da Home" },
  { value: "chat", label: "Chat principal" },
  { value: "summary", label: "Resumos automáticos" },
  { value: "report", label: "Relatórios" },
  { value: "audio", label: "Respostas por áudio" },
];

const SCOPES: Array<{ value: string; label: string }> = [
  { value: "user", label: "Somente para mim" },
  { value: "company", label: "Para esta empresa" },
  { value: "project", label: "Para este projeto" },
  { value: "global", label: "Padrão da plataforma" },
];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha na requisicao");
  return json as T;
}

export function BrainBehaviorProfiles() {
  const [profiles, setProfiles] = useState<BehaviorProfile[]>([]);
  const [requiresMigration, setRequiresMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [surface, setSurface] = useState<Surface>("chat");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [applySurfaces, setApplySurfaces] = useState<Record<Surface, boolean>>({
    home: true,
    chat: true,
    summary: false,
    report: false,
    audio: false,
  });
  const [scopeType, setScopeType] = useState("user");

  const [form, setForm] = useState({
    name: "",
    description: "",
    instructions: "",
    tone: "",
    formality: "neutral",
    responseLength: "medium",
    scopeType: "user",
  });

  const customProfiles = useMemo(() => profiles.filter((profile) => !profile.isSystem), [profiles]);
  const presetProfiles = useMemo(() => profiles.filter((profile) => profile.isSystem), [profiles]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [profileData, assignmentData] = await Promise.all([
        fetchJson<{ profiles?: BehaviorProfile[]; requiresMigration?: boolean; error?: string }>("/api/brain/behavior-profiles"),
        fetchJson<{ profile?: BehaviorProfile | null }>(`/api/brain/behavior-profiles/assignment?surface=${surface}`).catch(() => ({ profile: null })),
      ]);
      setProfiles(profileData.profiles ?? []);
      setRequiresMigration(profileData.requiresMigration === true);
      if (profileData.requiresMigration && profileData.error) setError(profileData.error);
      setSelectedProfileId(assignmentData.profile?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar perfis de comportamento");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface]);

  async function createProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await fetchJson("/api/brain/behavior-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setFeedback("Perfil de comportamento criado.");
      setForm((current) => ({ ...current, name: "", description: "", instructions: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar perfil de comportamento");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile(id: string) {
    setError(null);
    setFeedback(null);
    try {
      await fetchJson(`/api/brain/behavior-profiles/${encodeURIComponent(id)}`, { method: "DELETE" });
      setFeedback("Perfil removido.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover perfil de comportamento");
    }
  }

  async function applySelection() {
    if (!selectedProfileId) {
      setError("Selecione um perfil antes de aplicar.");
      return;
    }
    setError(null);
    setFeedback(null);
    const targetSurfaces = (Object.entries(applySurfaces) as Array<[Surface, boolean]>)
      .filter(([, checked]) => checked)
      .map(([value]) => value);

    if (!targetSurfaces.length) {
      setError("Selecione pelo menos um lugar para aplicar o perfil.");
      return;
    }

    try {
      await Promise.all(
        targetSurfaces.map((targetSurface) =>
          fetchJson("/api/brain/behavior-profiles/assignment", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scopeType, surface: targetSurface, profileId: selectedProfileId }),
          }),
        ),
      );
      setFeedback("Modo de conversa aplicado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aplicar modo de conversa");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100">
      <section className="mx-auto grid max-w-7xl gap-5">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/70">Brain</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Perfis de comportamento</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Defina o tom de conversa do Brain e escolha onde e para quem cada perfil se aplica.
            </p>
          </div>
          <button type="button" onClick={load} className="rounded-lg border border-cyan-200/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-200/10">
            Atualizar
          </button>
        </header>

        {requiresMigration ? (
          <p className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            A migration de perfis de comportamento do Brain ainda precisa ser aplicada para persistir perfis e seleções.
          </p>
        ) : null}
        {error ? <p className="rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
        {feedback ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</p> : null}

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <section className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-300">Modo de conversa</h2>
              <p className="mt-1 text-xs text-slate-400">Visualizando perfil aplicado para: {SURFACES.find((item) => item.value === surface)?.label}</p>

              <div className="mt-4 grid gap-2">
                <select value={surface} onChange={(event) => setSurface(event.target.value as Surface)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                  {SURFACES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>

                <div className="mt-2 grid gap-2">
                  {loading ? <p className="text-sm text-slate-400">Carregando perfis...</p> : null}
                  {presetProfiles.map((profile) => (
                    <label key={profile.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                      <input type="radio" name="selected-profile" checked={selectedProfileId === profile.id} onChange={() => setSelectedProfileId(profile.id)} />
                      {profile.name}
                    </label>
                  ))}
                  {customProfiles.map((profile) => (
                    <label key={profile.id} className="flex items-center justify-between gap-2 rounded-lg border border-cyan-200/20 bg-cyan-200/[0.04] px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <input type="radio" name="selected-profile" checked={selectedProfileId === profile.id} onChange={() => setSelectedProfileId(profile.id)} />
                        Personalizado: {profile.name}
                      </span>
                      <button type="button" onClick={() => deleteProfile(profile.id)} className="rounded-md border border-red-300/30 px-2 py-1 text-[10px] font-bold text-red-100 hover:bg-red-500/10">Excluir</button>
                    </label>
                  ))}
                </div>

                <div className="mt-3 rounded-lg border border-white/10 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Aplicar em</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SURFACES.map((item) => (
                      <label key={item.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={applySurfaces[item.value]}
                          onChange={(event) => setApplySurfaces((current) => ({ ...current, [item.value]: event.target.checked }))}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <select value={scopeType} onChange={(event) => setScopeType(event.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                  {SCOPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>

                <button type="button" onClick={applySelection} disabled={requiresMigration} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">
                  Aplicar modo de conversa
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <form onSubmit={createProfile} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-lg font-black">Novo perfil personalizado</h2>
              <div className="mt-4 grid gap-3">
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome (ex.: Assistente QA da Ana)" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descrição" rows={2} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <textarea value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} placeholder={"Instruções, ex.:\n- Responder de forma objetiva.\n- Priorizar Playwright, API e Qase."} rows={5} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.formality} onChange={(event) => setForm((current) => ({ ...current, formality: event.target.value }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                    <option value="formal">Formal</option>
                    <option value="neutral">Neutro</option>
                    <option value="casual">Casual</option>
                  </select>
                  <select value={form.responseLength} onChange={(event) => setForm((current) => ({ ...current, responseLength: event.target.value }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                    <option value="short">Curto</option>
                    <option value="medium">Médio</option>
                    <option value="long">Longo</option>
                  </select>
                </div>
                <select value={form.scopeType} onChange={(event) => setForm((current) => ({ ...current, scopeType: event.target.value }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                  {SCOPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <p className="text-[11px] text-slate-500">Escopo empresa/projeto exige permissão administrativa do Brain; escopo global exige permissão global explícita.</p>
                <button disabled={saving} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{saving ? "Salvando..." : "Criar perfil"}</button>
              </div>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}
