"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS = [
  ["pending", "Pendente"],
  ["ready", "Pode ir"],
  ["blocked", "Bloqueado"],
  ["cancelled", "Cancelado"],
  ["done", "Entregue / realizado"],
] as const;

const TYPE_OPTIONS = [
  ["delivery", "Entrega"],
  ["meeting", "Reunião Meet"],
] as const;

function toIsoLocal(date: string, time: string) {
  if (!date || !time) return "";
  return new Date(`${date}T${time}:00`).toISOString();
}

function endFromStart(date: string, time: string) {
  if (!date || !time) return "";
  const start = new Date(`${date}T${time}:00`);
  start.setMinutes(start.getMinutes() + 30);
  return start.toISOString();
}

export default function NewAgendaEventPage() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id") ?? "";
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"delivery" | "meeting">("delivery");
  const [status, setStatus] = useState("pending");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [participants, setParticipants] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const effectiveStatus = useMemo(() => {
    if (!date || !time) return "pending";
    return status === "pending" ? "ready" : status;
  }, [date, status, time]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const payload = {
      ...(editId ? { id: editId } : {}),
      title,
      type,
      status: effectiveStatus,
      releaseId: `${type}-${Date.now()}`,
      releaseName: title,
      markerLabel: type === "meeting" ? "Meet" : "Entrega",
      context: type === "meeting" ? "user" : "delivery",
      companySlug: companySlug || null,
      projectSlug: projectSlug || null,
      startAt: toIsoLocal(date, time),
      endAt: endFromStart(date, time),
      participantNames: participants,
      description,
      meet: type === "meeting",
      notificationRules: date && time ? ["Notificar participantes", "Lembrar 5 minutos antes"] : ["Fica pendente até definir data e horário"],
      brianRules: ["Registrar contexto no Brain", "Relacionar decisão, participantes e status"],
      audienceProfiles: ["leader_tc", "technical_support", "release_actor", "brain"],
    };

    const response = await fetch("/api/release-calendar", {
      method: editId ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      setMessage(body?.error ?? "Não foi possível salvar o agendamento.");
      return;
    }

    setMessage("Agendamento salvo e notificação registrada.");
    setTimeout(() => router.push("/agenda"), 600);
  }

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-50 p-4 text-[#011848] dark:bg-[#030712] dark:text-white">
      <section className="mx-auto grid max-w-4xl gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Agenda</p>
          <h1 className="text-2xl font-black">{editId ? "Editar agendamento" : "Novo agendamento"}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Entrega pode ficar pendente sem data. Reunião sempre é Meet e notifica participantes quando tiver dia e horário.</p>
        </div>

        <form onSubmit={save} className="grid gap-4">
          <label className="grid gap-1 text-sm font-bold">
            Tipo
            <select value={type} onChange={(event) => setType(event.target.value as "delivery" | "meeting")} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950">
              {TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-bold">
            Título
            <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Entregar plano de teste / Reunião de alinhamento" className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950" />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">
              Data
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Horário
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950" />
            </label>
          </div>

          <label className="grid gap-1 text-sm font-bold">
            Status
            <select value={effectiveStatus} onChange={(event) => setStatus(event.target.value)} disabled={!date || !time} className="rounded-xl border border-slate-200 bg-slate-50 p-3 disabled:opacity-70 dark:border-white/10 dark:bg-slate-950">
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {!date || !time ? <span className="text-xs text-slate-500">Sem data e horário fica pendente automaticamente.</span> : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">
              Empresa
              <input value={companySlug} onChange={(event) => setCompanySlug(event.target.value)} placeholder="slug da empresa" className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Projeto
              <input value={projectSlug} onChange={(event) => setProjectSlug(event.target.value)} placeholder="slug do projeto" className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950" />
            </label>
          </div>

          <label className="grid gap-1 text-sm font-bold">
            Participantes
            <textarea value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Nome ou e-mail, separados por vírgula" className="min-h-24 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950" />
          </label>

          <label className="grid gap-1 text-sm font-bold">
            Descrição
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que será entregue ou tratado na reunião" className="min-h-28 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950" />
          </label>

          {type === "meeting" ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100">Reunião marcada como Meet. Com data e horário, a agenda registra notificação para os participantes.</div> : null}
          {message ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold dark:border-white/10 dark:bg-slate-950">{message}</div> : null}

          <div className="flex flex-wrap gap-2">
            <button disabled={saving} className="rounded-xl bg-[#ef0001] px-5 py-3 text-sm font-black text-white disabled:opacity-70">{saving ? "Salvando..." : "Salvar agendamento"}</button>
            <button type="button" onClick={() => router.push("/agenda")} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black dark:border-white/10">Voltar</button>
          </div>
        </form>
      </section>
    </main>
  );
}
