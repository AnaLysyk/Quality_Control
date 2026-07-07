"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCalendar, FiCheckSquare, FiVideo, FiX } from "react-icons/fi";

type ChatActionKind = "meet" | "appointment" | "task";

type ChatAttachment = {
  kind: "file" | "link" | "note" | "system";
  label: string;
  url: string | null;
  mimeType: string | null;
  sizeLabel: string | null;
  sourceLabel: string | null;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toGoogleCalendarDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function resolvePeerId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("peer")?.trim() || "";
}

function readChatContext() {
  const title = document.querySelector("main header h1")?.textContent?.trim() || "Usuário";
  const subtitle = document.querySelector("main header h1")?.parentElement?.querySelector("div")?.textContent?.trim() || "";
  const currentUser = document.querySelector("aside .font-black")?.textContent?.trim() || "Você";
  const pieces = subtitle.split("•").map((item) => item.trim()).filter(Boolean);
  const company = pieces.length > 1 ? pieces[pieces.length - 1] : "";
  const handleOrEmail = pieces[0]?.replace(/^@/, "") ?? "";
  return { selectedName: title, selectedCompany: company, selectedHandleOrEmail: handleOrEmail, currentUser };
}

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Não foi possível concluir a ação.");
  }
  return response.json().catch(() => null);
}

function buildInternalNote(input: {
  action: ChatActionKind;
  title: string;
  start: Date;
  end: Date;
  details: string;
  selectedName: string;
  selectedHandleOrEmail: string;
  selectedCompany: string;
  currentUser: string;
}) {
  const typeLabel = input.action === "meet" ? "Ligação/reunião por Google Meet" : input.action === "task" ? "Tarefa interna" : "Compromisso interno";
  return [
    input.action === "task" ? "[TAREFA_CHAT_QC]" : "[AGENDA_CHAT_QC]",
    `Tipo: ${typeLabel}`,
    `Título: ${input.title}`,
    `Quando: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(input.start)}`,
    `Duração: ${Math.round((input.end.getTime() - input.start.getTime()) / 60000)} minutos`,
    `Criado por: ${input.currentUser}`,
    `Pessoa vinculada: ${input.selectedName}`,
    `Contato: ${input.selectedHandleOrEmail || "não informado"}`,
    `Empresa/contexto: ${input.selectedCompany || "não informado"}`,
    `Google Meet: ${input.action === "meet" ? "Sim" : "Não"}`,
    `Detalhes: ${input.details || "sem detalhes"}`,
    input.action === "task" ? "[/TAREFA_CHAT_QC]" : "[/AGENDA_CHAT_QC]",
  ].join("\n");
}

function ActionModal({ action, onClose, onSubmit }: { action: ChatActionKind; onClose: () => void; onSubmit: (input: { title: string; dateTime: string; duration: string; details: string }) => void }) {
  const context = useMemo(() => readChatContext(), []);
  const [title, setTitle] = useState(action === "meet" ? `Meet com ${context.selectedName}` : action === "task" ? `Tarefa para ${context.selectedName}` : `Compromisso com ${context.selectedName}`);
  const [dateTime, setDateTime] = useState(toLocalInputValue(addMinutes(new Date(), action === "task" ? 60 : 30)));
  const [duration, setDuration] = useState(action === "task" ? "60" : "30");
  const [details, setDetails] = useState("");
  const copy = action === "meet"
    ? { eyebrow: "Google Meet", title: "Agendar ligação/reunião por Meet", text: "Usa Google Meet e registra a reunião nas agendas internas das duas partes e da empresa.", button: "Agendar Meet" }
    : action === "task"
      ? { eyebrow: "Tarefa interna", title: "Criar tarefa para a pessoa", text: "Cria uma tarefa vinculada à conversa e gera notificação interna do sistema.", button: "Criar tarefa" }
      : { eyebrow: "Agenda interna", title: "Agendar compromisso com a pessoa", text: "Fluxo interno do sistema. Não abre Google Meet.", button: "Agendar compromisso" };

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/72 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-label={copy.title}>
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">{copy.eyebrow}</span>
            <h2 className="mt-1 text-xl font-black">{copy.title}</h2>
            <p className="mt-1 text-sm text-white/62">{copy.text}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 p-2 text-white/70 hover:text-white" aria-label="Fechar"><FiX /></button>
        </header>
        <div className="space-y-3">
          <label className="block text-sm font-bold">Título<input className="mt-1 w-full rounded-2xl border border-white/10 bg-white/8 px-3 py-2 outline-none" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-bold">Data e horário<input type="datetime-local" className="mt-1 w-full rounded-2xl border border-white/10 bg-white/8 px-3 py-2 outline-none" value={dateTime} onChange={(event) => setDateTime(event.target.value)} /></label>
            <label className="block text-sm font-bold">Duração<select className="mt-1 w-full rounded-2xl border border-white/10 bg-white/8 px-3 py-2 outline-none" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option></select></label>
          </div>
          <label className="block text-sm font-bold">{action === "task" ? "Descrição da tarefa" : "Contexto"}<textarea className="mt-1 w-full rounded-2xl border border-white/10 bg-white/8 px-3 py-2 outline-none" rows={4} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Pauta, objetivo, pendência ou observação..." /></label>
          <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-sm text-white/70"><strong className="block text-white">Partes envolvidas</strong>{context.currentUser} ↔ {context.selectedName}{context.selectedCompany ? <span className="block">Empresa/contexto: {context.selectedCompany}</span> : null}</div>
        </div>
        <footer className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white/75">Cancelar</button><button type="button" onClick={() => onSubmit({ title, dateTime, duration, details })} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white">{copy.button}</button></footer>
      </section>
    </div>
  );
}

export default function ChatConversationWorkflowActions() {
  const router = useRouter();
  const [peerId, setPeerId] = useState("");
  const [modal, setModal] = useState<ChatActionKind | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 4500);
  }, []);

  useEffect(() => {
    const updatePeer = () => setPeerId(resolvePeerId());
    updatePeer();
    const interval = window.setInterval(updatePeer, 800);
    return () => window.clearInterval(interval);
  }, []);

  const openAction = useCallback((action: ChatActionKind) => {
    if (!resolvePeerId()) return showToast("Selecione uma conversa para usar esta ação.");
    setModal(action);
  }, [showToast]);

  const submitAction = useCallback(async (action: ChatActionKind, input: { title: string; dateTime: string; duration: string; details: string }) => {
    const targetPeerId = resolvePeerId();
    if (!targetPeerId) return showToast("Selecione uma conversa antes de criar a ação.");
    const context = readChatContext();
    const start = new Date(input.dateTime);
    if (Number.isNaN(start.getTime())) return showToast("Informe uma data válida.");
    const end = addMinutes(start, Number(input.duration) || 30);
    const title = input.title.trim() || (action === "task" ? `Tarefa para ${context.selectedName}` : `Compromisso com ${context.selectedName}`);
    const note = buildInternalNote({ action, title, start, end, details: input.details.trim(), ...context });
    const participants = [context.currentUser, context.selectedName].filter(Boolean);
    const scheduleType = action === "task" ? "task" : action === "appointment" ? "internal_appointment" : "meeting";
    const meet = action === "meet";

    await postJson("/api/chat/schedules", {
      title,
      type: scheduleType,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      userIds: [targetPeerId],
      participantNames: participants,
      participantLabels: participants,
      companyName: context.selectedCompany || null,
      notes: input.details.trim() || note,
      meet,
      source: "chat_conversation_action",
      conversationPeerId: targetPeerId,
    });

    const attachments: ChatAttachment[] = [{ kind: "system", label: meet ? "Meet registrado na agenda" : action === "task" ? "Tarefa interna criada" : "Compromisso interno criado", url: null, mimeType: null, sizeLabel: meet ? "Google Meet" : "Fluxo interno", sourceLabel: meet ? "Meet" : action === "task" ? "Tarefa" : "Agenda" }];
    if (meet) attachments.push({ kind: "link", label: "Abrir Google Meet", url: "https://meet.google.com/new", mimeType: null, sizeLabel: "Reunião por Meet", sourceLabel: "Meet" });
    await postJson("/api/chat/messages", { peerId: targetPeerId, text: note, attachments });

    if (meet) {
      const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${toGoogleCalendarDate(start)}/${toGoogleCalendarDate(end)}`, details: `${input.details.trim() || "Reunião criada pelo Chat do Quality Control."}\n\n${note}`, location: "Google Meet" });
      if (context.selectedHandleOrEmail.includes("@")) params.set("add", context.selectedHandleOrEmail);
      window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener,noreferrer");
    }

    setModal(null);
    showToast(meet ? "Meet registrado e aberto para criação do link." : action === "task" ? "Tarefa interna registrada." : "Compromisso interno registrado.");
    router.push(`/agenda?view=mine&day=${encodeURIComponent(start.toISOString().slice(0, 10))}`);
  }, [router, showToast]);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const button = target?.closest("button");
      if (!button) return;
      const label = normalize(`${button.getAttribute("title") ?? ""} ${button.getAttribute("aria-label") ?? ""} ${button.textContent ?? ""}`);
      if (label.includes("ligacao") || label.includes("meet")) { event.preventDefault(); event.stopPropagation(); openAction("meet"); return; }
      if (label === "agenda" || label.endsWith(" agenda") || label.includes("compromisso")) { event.preventDefault(); event.stopPropagation(); openAction("appointment"); }
      if (label.includes("tarefa")) { event.preventDefault(); event.stopPropagation(); openAction("task"); }
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [openAction]);

  if (!peerId) return null;

  return (
    <>
      <div className="fixed right-4 top-24 z-[70] flex flex-col gap-2 sm:right-6">
        <button type="button" onClick={() => openAction("meet")} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/90 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur hover:bg-blue-950"><FiVideo /> Meet</button>
        <button type="button" onClick={() => openAction("appointment")} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/90 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur hover:bg-blue-950"><FiCalendar /> Compromisso</button>
        <button type="button" onClick={() => openAction("task")} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/90 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur hover:bg-blue-950"><FiCheckSquare /> Tarefa</button>
      </div>
      {toast ? <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-2xl" role="status">{toast}</div> : null}
      {modal ? <ActionModal action={modal} onClose={() => setModal(null)} onSubmit={(input) => void submitAction(modal, input).catch((error) => showToast(error instanceof Error ? error.message : "Não foi possível registrar."))} /> : null}
    </>
  );
}
