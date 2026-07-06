"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiMic, FiSend, FiX } from "react-icons/fi";

type QuickFigure = { emoji: string; label: string; description: string };
type QuickGif = { label: string; url: string; description: string };

type ChatAttachment = {
  kind: "file" | "link" | "note" | "system";
  label: string;
  url: string | null;
  mimeType: string | null;
  sizeLabel: string | null;
  sourceLabel: string | null;
};

const QUICK_FIGURES: QuickFigure[] = [
  { emoji: "👍", label: "Curtir", description: "Enviar curtida" },
  { emoji: "❤️", label: "Amei", description: "Enviar reação positiva" },
  { emoji: "✅", label: "Feito", description: "Confirmar que ficou resolvido" },
  { emoji: "👀", label: "Visto", description: "Avisar que está acompanhando" },
  { emoji: "🔥", label: "Destaque", description: "Marcar como importante" },
  { emoji: "🎉", label: "Celebrar", description: "Comemorar avanço" },
  { emoji: "🐞", label: "Bug", description: "Sinalizar problema" },
  { emoji: "⚠️", label: "Atenção", description: "Pedir cuidado" },
];

const QUICK_GIFS: QuickGif[] = [
  { label: "Digitando", url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif", description: "Enviar GIF rápido" },
  { label: "Feito", url: "https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif", description: "Enviar confirmação" },
  { label: "Celebrando", url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif", description: "Enviar comemoração" },
];

function decodeBrokenText(value: string) {
  return value
    .replaceAll("VocÃª", "Você")
    .replaceAll("NÃ£o", "Não")
    .replaceAll("nÃ£o", "não")
    .replaceAll("estÃ¡", "está")
    .replaceAll("EstÃ¡", "Está")
    .replaceAll("opÃ§Ãµes", "opções")
    .replaceAll("OpÃ§Ãµes", "Opções")
    .replaceAll("ReaÃ§Ã£o", "Reação")
    .replaceAll("reaÃ§Ã£o", "reação")
    .replaceAll("ReaÃ§Ãµes", "Reações")
    .replaceAll("comentÃ¡rio", "comentário")
    .replaceAll("avanÃ§o", "avanço")
    .replaceAll("AtenÃ§Ã£o", "Atenção")
    .replaceAll("tÃ©cnico", "técnico")
    .replaceAll("usuÃ¡rio", "usuário")
    .replaceAll("UsuÃ¡rio", "Usuário")
    .replaceAll("ligaÃ§Ã£o", "ligação")
    .replaceAll("LigaÃ§Ã£o", "Ligação")
    .replaceAll("horÃ¡rio", "horário")
    .replaceAll("DescriÃ§Ã£o", "Descrição")
    .replaceAll("descriÃ§Ã£o", "descrição")
    .replaceAll("calendÃ¡rio", "calendário")
    .replaceAll("DuraÃ§Ã£o", "Duração")
    .replaceAll("TÃ­tulo", "Título")
    .replaceAll("Ãcones", "Ícones")
    .replaceAll("rÃ¡pidos", "rápidos")
    .replaceAll("Ã ", "à")
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ãª", "ê")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã§", "ç")
    .replaceAll("â€¢", "•")
    .replaceAll("â†”", "↔");
}

function normalizeButtonText(value: string) {
  return decodeBrokenText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function resolvePeerId() {
  return new URLSearchParams(window.location.search).get("peer")?.trim() || "";
}

function readSelectedContext() {
  const title = document.querySelector("main header h1")?.textContent?.trim() || "Usuário";
  const subtitle = document.querySelector("main header h1")?.parentElement?.querySelector("div")?.textContent?.trim() || "";
  const currentUser = document.querySelector("aside .font-black")?.textContent?.trim() || "Você";
  const pieces = decodeBrokenText(subtitle).split("•").map((item) => item.trim()).filter(Boolean);
  const company = pieces.length > 1 ? pieces[pieces.length - 1] : "";
  const handleOrEmail = pieces[0]?.replace(/^@/, "") ?? "";

  return {
    selectedName: decodeBrokenText(title),
    selectedCompany: company,
    selectedHandleOrEmail: handleOrEmail,
    currentUser: decodeBrokenText(currentUser),
  };
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

export default function ChatRuntimeFixes() {
  const router = useRouter();
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 4200);
  }, []);

  const sendToPeer = useCallback(async (text: string, attachments: ChatAttachment[] = []) => {
    const peerId = resolvePeerId();
    if (!peerId) {
      showToast("Selecione uma conversa antes de enviar.");
      return false;
    }

    await postJson("/api/chat/messages", { peerId, text: text.trim(), attachments });
    window.setTimeout(() => window.location.reload(), 450);
    return true;
  }, [showToast]);

  const sendFigure = useCallback(async (figure: QuickFigure) => {
    setActionModalOpen(false);
    await sendToPeer(figure.emoji, [{ kind: "note", label: figure.emoji, url: null, mimeType: null, sizeLabel: null, sourceLabel: "Figurinha" }]).catch((error) => showToast(error instanceof Error ? error.message : "Não foi possível enviar."));
  }, [sendToPeer, showToast]);

  const sendGif = useCallback(async (gif: QuickGif) => {
    setActionModalOpen(false);
    await sendToPeer("", [{ kind: "link", label: gif.label, url: gif.url, mimeType: "image/gif", sizeLabel: null, sourceLabel: "GIF" }]).catch((error) => showToast(error instanceof Error ? error.message : "Não foi possível enviar."));
  }, [sendToPeer, showToast]);

  const startInstantMeet = useCallback(async () => {
    const peerId = resolvePeerId();
    if (!peerId) return showToast("Selecione uma conversa para iniciar a ligação.");

    const { selectedName, selectedCompany, selectedHandleOrEmail, currentUser } = readSelectedContext();
    const start = new Date();
    const end = addMinutes(start, 30);
    const title = `Ligação com ${selectedName}`;
    const participants = [currentUser, selectedName].filter(Boolean).join(", ");
    const meetUrl = "https://meet.google.com/new";

    await Promise.allSettled([
      postJson("/api/chat/schedules", {
        title,
        type: "meeting",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        userIds: [peerId],
        companyName: selectedCompany || null,
        notes: `Ligação iniciada agora. Participantes: ${participants}.`,
        meet: true,
        status: "started",
      }),
      postJson("/api/release-calendar", {
        title,
        type: "meeting",
        status: "planned",
        releaseId: `chat-call-${Date.now()}`,
        releaseName: title,
        markerLabel: "Meet",
        context: "user",
        companySlug: selectedCompany || null,
        projectSlug: null,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        participantNames: participants,
        description: `Ligação iniciada pelo chat. Participantes: ${participants}. Contato: ${selectedHandleOrEmail || "não informado"}.`,
        meet: true,
        notificationRules: ["Registrar na agenda", "Notificar participantes", "Lembrar 5 minutos antes"],
        brianRules: ["Registrar ligação no Brain", "Relacionar participantes, data e horário"],
        audienceProfiles: ["leader_tc", "technical_support", "testing_company_user", "company_user", "brain"],
      }),
      sendToPeer("", [{ kind: "link", label: "Abrir Google Meet", url: meetUrl, mimeType: null, sizeLabel: "Ligação iniciada agora", sourceLabel: "Meet" }]),
    ]);

    window.open(meetUrl, "_blank", "noopener,noreferrer");
    router.push(`/agenda?view=mine&day=${encodeURIComponent(start.toISOString().slice(0, 10))}`);
  }, [router, sendToPeer, showToast]);

  const openAgendaForPeer = useCallback(() => {
    const peerId = resolvePeerId();
    if (!peerId) return showToast("Selecione uma conversa para agendar.");

    const { selectedName, selectedCompany, selectedHandleOrEmail, currentUser } = readSelectedContext();
    const date = addMinutes(new Date(), 30);
    const params = new URLSearchParams({
      source: "chat",
      peerId,
      type: "meeting",
      meet: "1",
      title: `Reunião com ${selectedName}`,
      participants: [currentUser, selectedName, selectedHandleOrEmail].filter(Boolean).join(", "),
      company: selectedCompany,
      dateTime: toLocalInputValue(date),
      description: `Agendamento criado a partir do chat com ${selectedName}.`,
    });

    router.push(`/agenda/novo?${params.toString()}`);
  }, [router, showToast]);

  const stopAudioTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const uploadAudioAndSend = useCallback(async (blob: Blob) => {
    const peerId = resolvePeerId();
    if (!peerId) return;

    const extension = blob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([blob], `audio-chat-${Date.now()}.${extension}`, { type: blob.type || "audio/webm" });
    const form = new FormData();
    form.append("files", file, file.name);

    const upload = await fetch("/api/chat/attachments", { method: "POST", credentials: "include", body: form });
    const uploadBody = await upload.json().catch(() => null) as { attachments?: ChatAttachment[]; error?: string } | null;
    if (!upload.ok || !Array.isArray(uploadBody?.attachments)) throw new Error(uploadBody?.error ?? "Não foi possível enviar o áudio.");

    await postJson("/api/chat/messages", {
      peerId,
      text: "",
      attachments: uploadBody.attachments.map((attachment) => ({ ...attachment, sourceLabel: attachment.sourceLabel || "Áudio" })),
    });

    showToast("Áudio enviado.");
    window.setTimeout(() => window.location.reload(), 450);
  }, [showToast]);

  const toggleAudioRecording = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }

    if (!resolvePeerId()) return showToast("Selecione uma conversa para gravar áudio.");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return showToast("Este navegador não permitiu gravação de áudio.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        recorderRef.current = null;
        setRecording(false);
        stopAudioTracks();
        if (blob.size === 0) return showToast("Não consegui captar áudio.");
        void uploadAudioAndSend(blob).catch((error) => showToast(error instanceof Error ? error.message : "Não foi possível enviar o áudio."));
      };

      recorder.start();
      setRecording(true);
      showToast("Gravando áudio. Clique em Áudio novamente para enviar.");
    } catch {
      stopAudioTracks();
      setRecording(false);
      showToast("Microfone bloqueado. Libere o microfone e tente novamente.");
    }
  }, [recording, showToast, stopAudioTracks, uploadAudioAndSend]);

  useEffect(() => {
    const fixVisibleText = () => {
      const root = document.querySelector(".qc-chat-page-shell");
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const next = decodeBrokenText(node.textContent ?? "");
        if (next !== node.textContent) node.textContent = next;
        node = walker.nextNode();
      }
    };

    fixVisibleText();
    const interval = window.setInterval(fixVisibleText, 900);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const button = target?.closest("button");
      if (!button) return;

      const label = normalizeButtonText(`${button.getAttribute("title") ?? ""} ${button.getAttribute("aria-label") ?? ""} ${button.textContent ?? ""}`);

      if (label.includes("ligacao") || label.includes("meet")) {
        event.preventDefault();
        event.stopPropagation();
        void startInstantMeet();
        return;
      }

      if (label.includes("agendar reuniao") || label === "agenda" || label.endsWith(" agenda")) {
        event.preventDefault();
        event.stopPropagation();
        openAgendaForPeer();
        return;
      }

      if (label.includes("gravar audio") || label.endsWith(" audio") || label.includes(" áudio")) {
        event.preventDefault();
        event.stopPropagation();
        void toggleAudioRecording();
        return;
      }

      if (label.includes("abrir opcoes") || label === "opcoes") {
        event.preventDefault();
        event.stopPropagation();
        setActionModalOpen(true);
      }
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [openAgendaForPeer, startInstantMeet, toggleAudioRecording]);

  return (
    <>
      {toast ? <div className="qc-chat-runtime-toast" role="status" aria-live="polite">{toast}</div> : null}
      {recording ? <div className="qc-chat-runtime-recording"><FiMic size={16} /><span>Gravando áudio... clique em Áudio para enviar</span></div> : null}
      {actionModalOpen ? (
        <div className="qc-chat-profile-action-modal" role="dialog" aria-modal="true" aria-label="Enviar figura, GIF ou ícone">
          <button type="button" className="qc-chat-profile-action-modal__backdrop" onClick={() => setActionModalOpen(false)} aria-label="Fechar" />
          <section className="qc-chat-profile-action-modal__panel">
            <header>
              <div>
                <span>Enviar na conversa</span>
                <h2>Figuras, GIFs e ícones</h2>
                <p>Escolha uma opção para enviar direto para o usuário selecionado.</p>
              </div>
              <button type="button" onClick={() => setActionModalOpen(false)} aria-label="Fechar"><FiX size={18} /></button>
            </header>

            <div className="qc-chat-profile-action-modal__section">
              <h3>Ícones e figurinhas</h3>
              <div className="qc-chat-profile-action-modal__grid">
                {QUICK_FIGURES.map((figure) => (
                  <button key={figure.label} type="button" onClick={() => void sendFigure(figure)}>
                    <strong>{figure.emoji}</strong>
                    <span><b>{figure.label}</b><small>{figure.description}</small></span>
                  </button>
                ))}
              </div>
            </div>

            <div className="qc-chat-profile-action-modal__section">
              <h3>GIFs rápidos</h3>
              <div className="qc-chat-profile-action-modal__grid">
                {QUICK_GIFS.map((gif) => (
                  <button key={gif.label} type="button" onClick={() => void sendGif(gif)}>
                    <strong>🎞️</strong>
                    <span><b>{gif.label}</b><small>{gif.description}</small></span>
                  </button>
                ))}
              </div>
            </div>

            <footer>
              <button type="button" onClick={() => setActionModalOpen(false)}><FiX size={14} /> Cancelar</button>
              <button type="button" onClick={() => setActionModalOpen(false)}><FiSend size={14} /> Pronto</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
