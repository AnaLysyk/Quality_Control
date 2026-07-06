"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiCheck, FiX } from "react-icons/fi";

type AgendaKind = "meeting" | "request_followup" | "adjustment" | "delivery";

type HomeAgendaModalProps = {
  open: boolean;
  initialPrompt?: string;
  onClose: () => void;
  onCreated: (title: string, startAt: string) => void;
};

const KIND_COPY: Record<AgendaKind, { label: string; marker: string; releaseName: string; type: "discovery" | "qa_window" | "release"; checklist: string[]; brianRules: string[] }> = {
  meeting: {
    label: "Ligação / reunião",
    marker: "Ligação",
    releaseName: "Ligação / reunião pelo Brain",
    type: "discovery",
    checklist: ["Confirmar horário", "Confirmar participantes", "Registrar decisão da conversa"],
    brianRules: ["Agendamento criado dentro da conversa da Home", "Relacionar com o contexto citado pelo usuário"],
  },
  request_followup: {
    label: "Solicitação",
    marker: "Solicitação",
    releaseName: "Acompanhamento de solicitação",
    type: "qa_window",
    checklist: ["Identificar solicitação", "Definir ação: aprovar, recusar ou pedir ajuste", "Registrar retorno ao solicitante"],
    brianRules: ["Usar contexto de solicitações", "Não aprovar ou recusar sem confirmação explícita"],
  },
  adjustment: {
    label: "Pedido de ajuste",
    marker: "Ajuste",
    releaseName: "Pedido de ajuste",
    type: "qa_window",
    checklist: ["Descrever ajuste esperado", "Definir responsável", "Combinar prazo de retorno"],
    brianRules: ["Guardar motivo do ajuste", "Vincular com solicitação ou chamado quando informado"],
  },
  delivery: {
    label: "Entrega / validação",
    marker: "Entrega",
    releaseName: "Entrega agendada pelo Brain",
    type: "release",
    checklist: ["Definir escopo", "Confirmar data", "Registrar evidências após entrega"],
    brianRules: ["Relacionar com projeto, run, release ou plano quando informado"],
  },
};

function defaultDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function inferKind(prompt: string): AgendaKind {
  const text = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/solicit|aprova|aprovar|recusa|recusar|reprova|reprovar/.test(text)) return "request_followup";
  if (/ajuste|corrigir|correcao|alterar/.test(text)) return "adjustment";
  if (/entrega|release|run|plano|validacao|validar/.test(text)) return "delivery";
  return "meeting";
}

function titleFromPrompt(prompt: string, kind: AgendaKind) {
  const clean = prompt.trim().replace(/\s+/g, " ");
  if (clean.length > 8) return clean.slice(0, 90);
  return KIND_COPY[kind].releaseName;
}

function splitParticipants(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function HomeAgendaModal({ open, initialPrompt = "", onClose, onCreated }: HomeAgendaModalProps) {
  const [kind, setKind] = useState<AgendaKind>("meeting");
  const [title, setTitle] = useState("Ligação / reunião pelo Brain");
  const [startAt, setStartAt] = useState(defaultDateTime);
  const [duration, setDuration] = useState("30");
  const [participants, setParticipants] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedKind = KIND_COPY[kind];
  const canSave = title.trim().length > 0 && startAt.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    const nextKind = inferKind(initialPrompt);
    setKind(nextKind);
    setTitle(titleFromPrompt(initialPrompt, nextKind));
    setStartAt(defaultDateTime());
    setDuration("30");
    setParticipants("");
    setReference("");
    setDescription(initialPrompt ? `Origem: conversa com o Brain\nPedido: ${initialPrompt}` : "Origem: conversa com o Brain");
    setError(null);
  }, [initialPrompt, open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) {
      setError("Informe título e horário para criar o agendamento.");
      return;
    }

    const start = new Date(startAt);
    const minutes = Number(duration) > 0 ? Number(duration) : 30;
    const end = new Date(start.getTime() + minutes * 60 * 1000);
    const itemRef = reference.trim();

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/release-calendar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `brain-${kind}-${Date.now()}`,
          title: itemRef ? `${title.trim()} • ${itemRef}` : title.trim(),
          type: selectedKind.type,
          status: "planned",
          criticality: kind === "meeting" ? "normal" : "high",
          context: "user",
          markerLabel: selectedKind.marker,
          audienceProfiles: ["all", "leader_tc", "technical_support", "testing_company_user", "brain"],
          companyId: null,
          companySlug: null,
          companyName: null,
          projectId: null,
          projectSlug: null,
          releaseId: itemRef || `brain-${kind}-${Date.now()}`,
          releaseName: itemRef ? `${selectedKind.releaseName}: ${itemRef}` : selectedKind.releaseName,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          participantNames: splitParticipants(participants),
          description: [description.trim(), itemRef ? `Vínculo: ${itemRef}` : null].filter(Boolean).join("\n"),
          checklist: selectedKind.checklist,
          notificationRules: ["Avisar antes do horário", "Exibir na Home do Brain", "Exibir na Agenda"],
          brianRules: selectedKind.brianRules,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Falha ao criar agendamento.");
      onCreated(title.trim(), start.toISOString());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar agendamento.");
    } finally {
      setSaving(false);
    }
  }

  const kindOptions = useMemo(() => Object.entries(KIND_COPY) as Array<[AgendaKind, typeof KIND_COPY[AgendaKind]]>, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Agendamento pelo Brain">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f172a] text-white shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300">Brain agente</p>
            <h2 className="mt-1 text-xl font-black">Agendar pela conversa</h2>
            <p className="mt-1 text-sm text-slate-300">Marque ligação, acompanhamento de solicitação, pedido de ajuste ou entrega sem sair da Home.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Fechar agendamento"><FiX /></button>
        </div>

        <form onSubmit={submit} className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Tipo
            <select value={kind} onChange={(event) => setKind(event.target.value as AgendaKind)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none">
              {kindOptions.map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Horário
            <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
          </label>

          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 sm:col-span-2">
            Título
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Ligação com cliente para aprovar solicitação" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none placeholder:text-slate-600" />
          </label>

          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Duração
            <input type="number" min="15" step="15" value={duration} onChange={(event) => setDuration(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
          </label>

          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Vínculo opcional
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Solicitação, chamado, run, release..." className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none placeholder:text-slate-600" />
          </label>

          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 sm:col-span-2">
            Participantes
            <input value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Nomes separados por vírgula" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none placeholder:text-slate-600" />
          </label>

          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 sm:col-span-2">
            Contexto para o Brian lembrar
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none placeholder:text-slate-600" />
          </label>

          {error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 sm:col-span-2">{error}</p> : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10">Cancelar</button>
            <button type="submit" disabled={saving || !canSave} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-red-600 px-5 py-3 text-sm font-black text-white shadow-[0_10px_30px_rgba(239,68,68,0.22)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"><FiCheck /> {saving ? "Salvando..." : "Criar agendamento"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
