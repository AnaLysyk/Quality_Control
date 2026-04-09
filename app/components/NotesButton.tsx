"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiChevronRight,
  FiCopy,
  FiDownload,
  FiEdit3,
  FiMapPin,
  FiMaximize2,
  FiMinus,
  FiSave,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthUser } from "@/hooks/useAuthUser";

type NoteColorKey = "amber" | "sky" | "emerald" | "rose" | "violet" | "orange";
type NoteStatus = "Rascunho" | "Em andamento" | "Concluido" | "Arquivado";
type NotePriority = "Baixa" | "Media" | "Alta" | "Urgente";
type NoteFilterValue<T extends string> = T | "all";

type ColorOption = {
  key: NoteColorKey;
  label: string;
  bg: string;
  border: string;
  text: string;
};

type NoteItem = {
  id: string;
  title: string;
  content: string;
  color: NoteColorKey;
  status: NoteStatus;
  priority: NotePriority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type DraftNote = {
  title: string;
  content: string;
  color: NoteColorKey;
  status: NoteStatus;
  priority: NotePriority;
};

type NoteOption<T extends string> = {
  value: T;
  label: string;
  tone: "neutral" | "progress" | "positive" | "warning" | "danger";
};

type TextTransformContext = {
  value: string;
  start: number;
  end: number;
  selected: string;
};

type TextTransformResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

type EditorTool = {
  id: "h1" | "h2" | "h3" | "list" | "orderedList" | "checklist" | "quote" | "divider" | "bold" | "italic" | "highlight" | "code" | "json" | "link";
  label: string;
  title: string;
  group: "structure" | "style";
};

type NoteSnippet = {
  id: "decision" | "nextSteps" | "risk" | "context" | "linkBlock" | "codeBlock";
  label: string;
  title: string;
  text: string;
};

const NOTE_COLORS: ColorOption[] = [
  { key: "amber", label: "Ambar", bg: "#fffbeb", border: "#f59e0b", text: "#78350f" },
  { key: "sky", label: "Azul", bg: "#f0f9ff", border: "#0ea5e9", text: "#0c4a6e" },
  { key: "emerald", label: "Verde", bg: "#f0fdf4", border: "#10b981", text: "#064e3b" },
  { key: "rose", label: "Rosa", bg: "#fff1f2", border: "#f43f5e", text: "#881337" },
  { key: "violet", label: "Violeta", bg: "#faf5ff", border: "#8b5cf6", text: "#2e1065" },
  { key: "orange", label: "Laranja", bg: "#fff7ed", border: "#f97316", text: "#7c2d12" },
];

const NOTE_STATUS_OPTIONS: NoteOption<NoteStatus>[] = [
  { value: "Rascunho", label: "Rascunho", tone: "neutral" },
  { value: "Em andamento", label: "Em andamento", tone: "warning" },
  { value: "Concluido", label: "Concluido", tone: "positive" },
  { value: "Arquivado", label: "Arquivado", tone: "progress" },
];

const NOTE_PRIORITY_OPTIONS: NoteOption<NotePriority>[] = [
  { value: "Baixa", label: "Baixa", tone: "neutral" },
  { value: "Media", label: "Media", tone: "progress" },
  { value: "Alta", label: "Alta", tone: "warning" },
  { value: "Urgente", label: "Urgente", tone: "danger" },
];

const EDITOR_TOOLS: EditorTool[] = [
  { id: "h1", label: "H1", title: "Titulo", group: "structure" },
  { id: "h2", label: "H2", title: "Subtitulo", group: "structure" },
  { id: "h3", label: "H3", title: "Secao", group: "structure" },
  { id: "list", label: "Lista", title: "Lista com marcadores", group: "structure" },
  { id: "orderedList", label: "1.", title: "Lista numerada", group: "structure" },
  { id: "checklist", label: "Check", title: "Checklist", group: "structure" },
  { id: "quote", label: "Aspas", title: "Bloco de citacao", group: "style" },
  { id: "divider", label: "---", title: "Divisor", group: "style" },
  { id: "bold", label: "Negrito", title: "Negrito", group: "style" },
  { id: "italic", label: "Italico", title: "Italico", group: "style" },
  { id: "highlight", label: "Grifo", title: "Destaque", group: "style" },
  { id: "code", label: "</>", title: "Bloco de codigo", group: "style" },
  { id: "json", label: "{ }", title: "JSON formatado", group: "style" },
  { id: "link", label: "Link", title: "Link clicavel", group: "style" },
];

const NOTE_SNIPPETS: NoteSnippet[] = [
  {
    id: "decision",
    label: "Decisao",
    title: "Inserir bloco de decisao",
    text: "## Decisao\n- Contexto:\n- Definicao:\n- Impacto:\n",
  },
  {
    id: "nextSteps",
    label: "Proximos passos",
    title: "Inserir bloco de proximos passos",
    text: "## Proximos passos\n- [ ] Item 1\n- [ ] Item 2\n- [ ] Item 3\n",
  },
  {
    id: "risk",
    label: "Risco",
    title: "Inserir bloco de risco",
    text: "## Risco\n- Descricao:\n- Impacto:\n- Mitigacao:\n",
  },
  {
    id: "context",
    label: "Contexto",
    title: "Inserir bloco de contexto",
    text: "## Contexto\n- Objetivo:\n- Premissas:\n- Referencias:\n",
  },
  {
    id: "linkBlock",
    label: "Referencias",
    title: "Inserir bloco de referencias",
    text: "## Referencias\n- [Link principal](https://exemplo.com)\n",
  },
  {
    id: "codeBlock",
    label: "Codigo",
    title: "Inserir bloco de codigo",
    text: "```ts\n// observacao tecnica\n```\n",
  },
];

const NOTE_MARKERS = [
  { icon: "\u2705", label: "Tarefa" },
  { icon: "\u26A0\uFE0F", label: "Alerta" },
  { icon: "\uD83D\uDCCC", label: "Prioridade" },
  { icon: "\uD83D\uDCA1", label: "Ideia" },
  { icon: "\uD83D\uDEE0\uFE0F", label: "Ajuste" },
  { icon: "\uD83D\uDD17", label: "Link" },
] as const;
const WIDGET_POS_KEY = "qc:notes_widget_pos";
const WIDGET_STATE_KEY = "qc:notes_widget_state";
const WIDGET_WIDTH_KEY = "qc:notes_widget_width";
const WIDGET_HEIGHT_KEY = "qc:notes_widget_height";
const INLINE_TOKEN_REGEX =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|==([^=]+)==|`([^`]+)`|_([^_]+)_|(https?:\/\/[^\s]+)/g;
let testingLogoPromise: Promise<string | null> | null = null;
const NOTES_WIDGET_VIEW_WIDTH = 860;
const NOTES_WIDGET_EDIT_WIDTH = 920;
const NOTES_WIDGET_MIN_WIDTH = 720;
const NOTES_WIDGET_MIN_WIDTH_EDITING = 860;
const NOTES_WIDGET_MAX_WIDTH = 1180;
const NOTES_WIDGET_VIEW_HEIGHT = 780;
const NOTES_WIDGET_EDIT_HEIGHT = 900;
const NOTES_WIDGET_MIN_HEIGHT = 520;
const NOTES_WIDGET_MIN_HEIGHT_EDITING = 700;
const NOTES_WIDGET_MAX_HEIGHT = 1120;

const NOTES_WIDGET_Z_INDEX = 13050;

type NotesButtonProps = {
  defaultOpen?: boolean;
};

function loadWidgetPos(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(WIDGET_POS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveWidgetPos(pos: { x: number; y: number }) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(WIDGET_POS_KEY, JSON.stringify(pos));
  } catch {
    // noop
  }
}

function loadWidgetState(): { minimized: boolean; pinned: boolean } {
  if (typeof window === "undefined") return { minimized: false, pinned: false };
  try {
    const raw = window.sessionStorage.getItem(WIDGET_STATE_KEY);
    return raw ? JSON.parse(raw) : { minimized: false, pinned: false };
  } catch {
    return { minimized: false, pinned: false };
  }
}

function saveWidgetState(state: { minimized: boolean; pinned: boolean }) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(WIDGET_STATE_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
}

function clampWidgetWidth(width: number, minWidth: number) {
  return Math.max(minWidth, Math.min(width, NOTES_WIDGET_MAX_WIDTH));
}

function clampWidgetHeight(height: number, minHeight: number) {
  return Math.max(minHeight, Math.min(height, NOTES_WIDGET_MAX_HEIGHT));
}

function loadWidgetWidth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(WIDGET_WIDTH_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveWidgetWidth(width: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(WIDGET_WIDTH_KEY, String(width));
  } catch {
    // noop
  }
}

function loadWidgetHeight() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(WIDGET_HEIGHT_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveWidgetHeight(height: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(WIDGET_HEIGHT_KEY, String(height));
  } catch {
    // noop
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Falha ao carregar imagem"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao carregar imagem"));
    reader.readAsDataURL(blob);
  });
}

async function getTestingLogoDataUrl() {
  if (!testingLogoPromise) {
    testingLogoPromise = fetch("/images/tc.png", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) return null;
        return blobToDataUrl(await response.blob());
      })
      .catch(() => null);
  }

  return testingLogoPromise;
}

function normalizeColor(value: unknown): NoteColorKey {
  if (typeof value === "string" && NOTE_COLORS.some((color) => color.key === value)) {
    return value as NoteColorKey;
  }
  return "amber";
}

function normalizeStatus(value: unknown): NoteStatus {
  if (typeof value === "string" && NOTE_STATUS_OPTIONS.some((option) => option.value === value)) {
    return value as NoteStatus;
  }
  return "Rascunho";
}

function normalizePriority(value: unknown): NotePriority {
  if (typeof value === "string" && NOTE_PRIORITY_OPTIONS.some((option) => option.value === value)) {
    return value as NotePriority;
  }
  return "Media";
}

function normalizeTag(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/,+/g, "")
    .slice(0, 24);
}

function normalizeTags(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]/) : [];
  return Array.from(new Set(source.map((item) => normalizeTag(item)).filter(Boolean))).slice(0, 12);
}

function normalizeNoteItem(note: Partial<NoteItem> | null | undefined): NoteItem {
  return {
    id: typeof note?.id === "string" && note.id.trim() ? note.id : crypto.randomUUID(),
    title: typeof note?.title === "string" && note.title.trim() ? note.title.trim().slice(0, 120) : "Sem titulo",
    content: typeof note?.content === "string" ? note.content.trim().slice(0, 12000) : "",
    color: normalizeColor(note?.color),
    status: normalizeStatus(note?.status),
    priority: normalizePriority(note?.priority),
    tags: normalizeTags(note?.tags),
    createdAt: typeof note?.createdAt === "string" && note.createdAt ? note.createdAt : new Date().toISOString(),
    updatedAt: typeof note?.updatedAt === "string" && note.updatedAt ? note.updatedAt : new Date().toISOString(),
  };
}

function createDraft(color: NoteColorKey): DraftNote {
  return {
    title: "",
    content: "",
    color,
    status: "Rascunho",
    priority: "Media",
  };
}

function getStatusOption(status: NoteStatus) {
  return NOTE_STATUS_OPTIONS.find((option) => option.value === status) ?? NOTE_STATUS_OPTIONS[0];
}

function getPriorityOption(priority: NotePriority) {
  return NOTE_PRIORITY_OPTIONS.find((option) => option.value === priority) ?? NOTE_PRIORITY_OPTIONS[1];
}

function getEditorToolFeedback(toolId: EditorTool["id"]) {
  switch (toolId) {
    case "h1":
      return "Titulo principal aplicado na linha atual.";
    case "h2":
      return "Subtitulo aplicado na linha atual.";
    case "h3":
      return "Secao inserida para organizar o conteudo.";
    case "list":
      return "Lista com marcadores aplicada.";
    case "orderedList":
      return "Lista numerada aplicada.";
    case "checklist":
      return "Checklist inserida no cursor.";
    case "quote":
      return "Bloco de citacao aplicado.";
    case "divider":
      return "Divisor inserido no texto.";
    case "bold":
      return "Negrito aplicado na selecao.";
    case "italic":
      return "Italico aplicado na selecao.";
    case "highlight":
      return "Destaque aplicado na selecao.";
    case "code":
      return "Bloco de codigo inserido.";
    case "json":
      return "JSON formatado ou modelo inserido.";
    case "link":
      return "Estrutura de link inserida no cursor.";
    default:
      return "Formatacao aplicada.";
  }
}

function getSnippetFeedback(label: string) {
  return `${label} inserido no texto.`;
}

function getNoteColorLabel(color: NoteColorKey) {
  return NOTE_COLORS.find((item) => item.key === color)?.label ?? color;
}

function ColorSwatchButton({
  color,
  active,
  onClick,
  size = "md",
}: {
  color: ColorOption;
  active: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Selecionar ${color.label}`}
      aria-pressed={!!active}
      className={`group relative ${sizeClass} rounded-full border-2 note-swatch-${color.key} shadow-[0_8px_18px_rgba(15,23,42,0.18)] transition-all duration-150 hover:-translate-y-px hover:scale-[1.08] ${
        active
          ? "opacity-100 ring-2 ring-white/90 ring-offset-2 ring-offset-white scale-[1.08]"
          : "opacity-80 hover:opacity-100"
      }`}
    >
      <span className="pointer-events-none absolute left-1/2 top-[-0.6rem] -translate-x-1/2 -translate-y-full rounded-full border border-white/12 bg-[#09142d]/92 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white opacity-0 shadow-[0_10px_24px_rgba(2,6,23,0.4)] transition-all duration-150 group-hover:-translate-y-0.5 group-hover:opacity-100">
        {color.label}
      </span>
    </button>
  );
}

function formatNoteDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Atualizada agora";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNoteDateFull(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Agora";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPlainNoteContent(content: string) {
  return content
    .replace(/```[\w-]*\n?([\s\S]*?)```/g, "$1")
    .replace(/^\s*#{1,2}\s+/gm, "")
    .replace(/^\s*-\s\[(?: |x|X)\]\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripNoteFormatting(content: string) {
  return getPlainNoteContent(content).replace(/\s+/g, " ").trim();
}

function getNotePreview(content: string, maxLength = 112) {
  const plain = stripNoteFormatting(content);
  if (!plain) return "Abra a nota para escrever checklist, links, codigo ou observacoes mais completas.";
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 3).trim()}...`;
}

function formatNoteForClipboard(note: Pick<NoteItem, "title" | "content" | "status" | "priority" | "updatedAt" | "createdAt">) {
  return [
    "Quality Control | Bloco de notas",
    "",
    `Titulo: ${note.title || "Sem titulo"}`,
    `Data: ${formatNoteDateFull(note.updatedAt || note.createdAt)}`,
    `Status: ${getStatusOption(note.status).label}`,
    `Prioridade: ${getPriorityOption(note.priority).label}`,
    "",
    "Descricao:",
    getPlainNoteContent(note.content) || "Sem descricao.",
  ].join("\n");
}

function prettifyJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

function getNoteEmoji(note: Pick<NoteItem, "color" | "content" | "title">) {
  const haystack = `${note.title}\n${note.content}`.toLowerCase();
  if (/^\s*-\s\[(?: |x|X)\]\s+/m.test(note.content)) return "\u2705";
  if (/```(?:json|ts|tsx|js|jsx|bash|sql)?/i.test(note.content) || prettifyJson(note.content)) return "\uD83E\uDDE9";
  if (/https?:\/\//i.test(note.content)) return "\uD83D\uDD17";
  if (haystack.includes("alerta") || haystack.includes("urgente")) return "\u26A0\uFE0F";
  if (haystack.includes("ideia") || haystack.includes("melhoria")) return "\uD83D\uDCA1";

  switch (note.color) {
    case "sky":
      return "\uD83D\uDCDD";
    case "emerald":
      return "\u2705";
    case "rose":
      return "\uD83C\uDF38";
    case "violet":
      return "\u2728";
    case "orange":
      return "\uD83D\uDD25";
    default:
      return "\uD83D\uDCCC";
  }
}

function getLeadingMarker(text: string) {
  const normalized = text.trimStart();

  for (const marker of NOTE_MARKERS) {
    if (normalized === marker.icon) {
      return { icon: marker.icon, label: marker.label, content: "" };
    }

    if (normalized.startsWith(`${marker.icon} `)) {
      return {
        icon: marker.icon,
        label: marker.label,
        content: normalized.slice(marker.icon.length).trimStart(),
      };
    }
  }

  return null;
}

function renderInlineText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_TOKEN_REGEX)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    const fullMatch = match[0];
    const markdownLinkLabel = match[1];
    const markdownLinkHref = match[2];
    const boldText = match[3];
    const highlightedText = match[4];
    const codeText = match[5];
    const italicText = match[6];
    const bareLink = match[7];
    const key = `${keyPrefix}-${index}`;

    if (markdownLinkLabel && markdownLinkHref) {
      nodes.push(
        <a key={key} href={markdownLinkHref} target="_blank" rel="noreferrer" className="notes-rich-link">
          {markdownLinkLabel}
        </a>,
      );
    } else if (boldText) {
      nodes.push(
        <strong key={key} className="notes-rich-strong">
          {boldText}
        </strong>,
      );
    } else if (highlightedText) {
      nodes.push(
        <mark key={key} className="notes-rich-highlight">
          {highlightedText}
        </mark>,
      );
    } else if (codeText) {
      nodes.push(
        <code key={key} className="notes-rich-inline-code">
          {codeText}
        </code>,
      );
    } else if (italicText) {
      nodes.push(
        <em key={key} className="notes-rich-emphasis">
          {italicText}
        </em>,
      );
    } else if (bareLink) {
      nodes.push(
        <a key={key} href={bareLink} target="_blank" rel="noreferrer" className="notes-rich-link">
          {bareLink}
        </a>,
      );
    } else {
      nodes.push(fullMatch);
    }

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderInlineWithBreaks(text: string, keyPrefix: string) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];

  lines.forEach((line, index) => {
    if (index > 0) {
      nodes.push(<br key={`${keyPrefix}-br-${index}`} />);
    }
    nodes.push(...renderInlineText(line, `${keyPrefix}-${index}`));
  });

  return nodes;
}

function renderCodeBlock(language: string, code: string, key: string) {
  const normalizedLanguage = language.trim().toLowerCase() || "texto";
  const normalizedCode = normalizedLanguage === "json" ? prettifyJson(code) ?? code : code;

  return (
    <div key={key} className="notes-rich-code-shell">
      <div className="notes-rich-code-label">{normalizedLanguage.toUpperCase()}</div>
      <pre className="notes-rich-code">
        <code>{normalizedCode}</code>
      </pre>
    </div>
  );
}

function renderRichContent(content: string) {
  if (!content.trim()) {
    return <p className="notes-rich-empty">Sem conteudo ainda. Use titulos, checklist, links ou codigo para estruturar melhor a nota.</p>;
  }

  const standaloneJson = prettifyJson(content);
  if (standaloneJson) {
    return renderCodeBlock("json", standaloneJson, "rich-json");
  }

  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      let innerIndex = index + 1;

      while (innerIndex < lines.length && !lines[innerIndex].trim().startsWith("```")) {
        codeLines.push(lines[innerIndex]);
        innerIndex += 1;
      }

      blocks.push(renderCodeBlock(language, codeLines.join("\n").trimEnd(), `code-${index}`));
      index = innerIndex < lines.length ? innerIndex + 1 : innerIndex;
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      blocks.push(
        <h4 key={`section-${index}`} className="notes-rich-subtitle">
          {renderInlineWithBreaks(trimmed.replace(/^###\s+/, ""), `section-${index}`)}
        </h4>,
      );
      index += 1;
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      blocks.push(
        <h3 key={`sub-${index}`} className="notes-rich-subtitle">
          {renderInlineWithBreaks(trimmed.replace(/^##\s+/, ""), `sub-${index}`)}
        </h3>,
      );
      index += 1;
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      blocks.push(
        <h2 key={`title-${index}`} className="notes-rich-title">
          {renderInlineWithBreaks(trimmed.replace(/^#\s+/, ""), `title-${index}`)}
        </h2>,
      );
      index += 1;
      continue;
    }

    if (/^\s*-\s\[(?: |x|X)\]\s+/.test(line)) {
      const items: ReactNode[] = [];
      let innerIndex = index;

      while (innerIndex < lines.length && /^\s*-\s\[(?: |x|X)\]\s+/.test(lines[innerIndex])) {
        const itemLine = lines[innerIndex];
        const checked = /^\s*-\s\[x\]\s+/i.test(itemLine);
        const itemText = itemLine.replace(/^\s*-\s\[(?: |x|X)\]\s+/, "");

        items.push(
          <li key={`check-${innerIndex}`} className="notes-rich-check-item">
            <input type="checkbox" checked={checked} readOnly className="notes-rich-checkbox" aria-label={itemText} />
            <span>{renderInlineWithBreaks(itemText, `check-${innerIndex}`)}</span>
          </li>,
        );

        innerIndex += 1;
      }

      blocks.push(
        <ul key={`checklist-${index}`} className="notes-rich-checklist">
          {items}
        </ul>,
      );
      index = innerIndex;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      let innerIndex = index;

      while (innerIndex < lines.length && /^\s*[-*]\s+/.test(lines[innerIndex]) && !/^\s*-\s\[(?: |x|X)\]\s+/.test(lines[innerIndex])) {
        items.push(
          <li key={`list-${innerIndex}`}>{renderInlineWithBreaks(lines[innerIndex].replace(/^\s*[-*]\s+/, ""), `list-${innerIndex}`)}</li>,
        );
        innerIndex += 1;
      }

      blocks.push(
        <ul key={`list-shell-${index}`} className="notes-rich-list">
          {items}
        </ul>,
      );
      index = innerIndex;
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      let innerIndex = index;

      while (innerIndex < lines.length && /^\s*\d+\.\s+/.test(lines[innerIndex])) {
        items.push(
          <li key={`ordered-${innerIndex}`}>
            {renderInlineWithBreaks(lines[innerIndex].replace(/^\s*\d+\.\s+/, ""), `ordered-${innerIndex}`)}
          </li>,
        );
        innerIndex += 1;
      }

      blocks.push(
        <ol key={`ordered-shell-${index}`} className="notes-rich-list notes-rich-list-numbered">
          {items}
        </ol>,
      );
      index = innerIndex;
      continue;
    }

    if (/^>\s+/.test(trimmed)) {
      const quoteLines: string[] = [];
      let innerIndex = index;

      while (innerIndex < lines.length && /^>\s+/.test(lines[innerIndex].trim())) {
        quoteLines.push(lines[innerIndex].trim().replace(/^>\s+/, ""));
        innerIndex += 1;
      }

      blocks.push(
        <blockquote key={`quote-${index}`} className="notes-rich-quote">
          {renderInlineWithBreaks(quoteLines.join("\n"), `quote-${index}`)}
        </blockquote>,
      );
      index = innerIndex;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`divider-${index}`} className="notes-rich-divider" />);
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    let innerIndex = index + 1;

    while (
      innerIndex < lines.length &&
      lines[innerIndex].trim() &&
      !lines[innerIndex].trim().startsWith("```") &&
      !/^#{1,3}\s+/.test(lines[innerIndex].trim()) &&
      !/^\s*-\s\[(?: |x|X)\]\s+/.test(lines[innerIndex]) &&
      !/^\s*[-*]\s+/.test(lines[innerIndex]) &&
      !/^\s*\d+\.\s+/.test(lines[innerIndex]) &&
      !/^>\s+/.test(lines[innerIndex].trim()) &&
      !/^---+$/.test(lines[innerIndex].trim())
    ) {
      paragraphLines.push(lines[innerIndex]);
      innerIndex += 1;
    }

    const markerLines = paragraphLines.map((paragraphLine) => getLeadingMarker(paragraphLine));

    if (markerLines.every(Boolean)) {
      blocks.push(
        <div key={`marker-group-${index}`} className="notes-rich-marker-group">
          {markerLines.map((markerLine, markerIndex) => (
            <div key={`marker-line-${index}-${markerIndex}`} className="notes-rich-marker-line">
              <span className="notes-rich-marker-icon" aria-hidden>
                {markerLine?.icon}
              </span>
              <span className="notes-rich-marker-text">
                {markerLine?.content
                  ? renderInlineText(markerLine.content, `marker-${index}-${markerIndex}`)
                  : markerLine?.label}
              </span>
            </div>
          ))}
        </div>,
      );
      index = innerIndex;
      continue;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="notes-rich-paragraph">
        {renderInlineWithBreaks(paragraphLines.join("\n"), `paragraph-${index}`)}
      </p>,
    );
    index = innerIndex;
  }

  return <>{blocks}</>;
}

function replaceSelection(value: string, start: number, end: number, replacement: string, selectLength = replacement.length): TextTransformResult {
  const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  const selectionStart = start;
  return {
    value: nextValue,
    selectionStart,
    selectionEnd: selectionStart + selectLength,
  };
}

function wrapSelection(
  context: TextTransformContext,
  before: string,
  after: string,
  placeholder: string,
): TextTransformResult {
  const selectedText = context.selected || placeholder;
  const replacement = `${before}${selectedText}${after}`;
  const next = replaceSelection(context.value, context.start, context.end, replacement, selectedText.length);
  return {
    ...next,
    selectionStart: context.start + before.length,
    selectionEnd: context.start + before.length + selectedText.length,
  };
}

function toggleLinePrefix(context: TextTransformContext, prefix: string): TextTransformResult {
  const selectionStart = context.value.lastIndexOf("\n", Math.max(0, context.start - 1)) + 1;
  let selectionEnd = context.value.indexOf("\n", context.end);
  if (selectionEnd === -1) selectionEnd = context.value.length;

  const selectedBlock = context.value.slice(selectionStart, selectionEnd);
  const lines = selectedBlock.split("\n");
  const shouldRemovePrefix = lines.every((line) => !line.trim() || line.startsWith(prefix));
  const nextLines = lines.map((line) => {
    if (!line.trim()) return line;
    if (shouldRemovePrefix && line.startsWith(prefix)) return line.slice(prefix.length);
    if (!shouldRemovePrefix && !line.startsWith(prefix)) return `${prefix}${line}`;
    return line;
  });
  const replacement = nextLines.join("\n");
  const nextValue = `${context.value.slice(0, selectionStart)}${replacement}${context.value.slice(selectionEnd)}`;
  const delta = replacement.length - selectedBlock.length;

  return {
    value: nextValue,
    selectionStart,
    selectionEnd: context.end + delta,
  };
}

function wrapFencedBlock(context: TextTransformContext, language: string, placeholder: string): TextTransformResult {
  const prefix = context.start > 0 && context.value[context.start - 1] !== "\n" ? "\n\n" : "";
  const suffix = context.end < context.value.length && context.value[context.end] !== "\n" ? "\n\n" : "";
  const body = context.selected || placeholder;
  const opening = `\`\`\`${language}\n`;
  const closing = "\n```";
  const replacement = `${prefix}${opening}${body}${closing}${suffix}`;
  const nextValue = `${context.value.slice(0, context.start)}${replacement}${context.value.slice(context.end)}`;
  const bodyStart = context.start + prefix.length + opening.length;

  return {
    value: nextValue,
    selectionStart: bodyStart,
    selectionEnd: bodyStart + body.length,
  };
}

function insertText(context: TextTransformContext, text: string): TextTransformResult {
  return replaceSelection(context.value, context.start, context.end, text, text.length);
}

function insertDivider(context: TextTransformContext): TextTransformResult {
  const prefix = context.start > 0 && context.value[context.start - 1] !== "\n" ? "\n" : "";
  const suffix = context.end < context.value.length && context.value[context.end] !== "\n" ? "\n" : "";
  return insertText(context, `${prefix}---${suffix}\n`);
}

function formatJsonTransform(context: TextTransformContext): TextTransformResult | null {
  const selectedJson = context.selected.trim();
  if (selectedJson) {
    const prettySelected = prettifyJson(selectedJson);
    if (!prettySelected) return null;
    return wrapFencedBlock(
      {
        ...context,
        selected: prettySelected,
      },
      "json",
      prettySelected,
    );
  }

  const fullJson = prettifyJson(context.value);
  if (fullJson) {
    const replacement = `\`\`\`json\n${fullJson}\n\`\`\``;
    return {
      value: replacement,
      selectionStart: 8,
      selectionEnd: 8 + fullJson.length,
    };
  }

  return wrapFencedBlock(context, "json", '{\n  "titulo": "Nova nota",\n  "status": "rascunho"\n}');
}

function NoteEditor({
  eyebrow,
  draft,
  saving,
  lastAction,
  activeToolId,
  activeMarkerLabel,
  onTitleChange,
  onContentChange,
  onColorChange,
  onStatusChange,
  onPriorityChange,
  onSave,
  onCancel,
  onDelete,
  onCopy,
  onExport,
  onApplyTool,
  onInsertSnippet,
  textareaRef,
}: {
  eyebrow: string;
  draft: DraftNote;
  saving: boolean;
  lastAction: string | null;
  activeToolId: EditorTool["id"] | null;
  activeMarkerLabel: string | null;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onColorChange: (color: NoteColorKey) => void;
  onStatusChange: (value: NoteStatus) => void;
  onPriorityChange: (value: NotePriority) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onExport?: () => void;
  onApplyTool: (toolId: EditorTool["id"]) => void;
  onInsertSnippet: (snippet: NoteSnippet) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const statusOption = getStatusOption(draft.status);
  const priorityOption = getPriorityOption(draft.priority);
  const primaryToolIds: EditorTool["id"][] = ["bold", "italic", "list", "checklist", "link"];
  const primaryTools = EDITOR_TOOLS.filter((tool) => primaryToolIds.includes(tool.id));
  const advancedTools = EDITOR_TOOLS.filter((tool) => !primaryToolIds.includes(tool.id));
  const [activePanel, setActivePanel] = useState<"write" | "preview">("write");
  const [openMenu, setOpenMenu] = useState<"format" | "insert" | null>(null);

  return (
    <div className="notes-editor-sheet-shell">
      <div className="notes-editor-sheet-main">
      <p className="notes-card-eyebrow">{eyebrow}</p>
      <div className="notes-editor-sheet-content mt-3 space-y-4">
        <input
          autoFocus
          className="notes-input notes-title-input"
          placeholder="Titulo da nota"
          value={draft.title}
          onChange={(event) => onTitleChange(event.target.value)}
        />

        <div className="notes-editor-modern-shell">
          <div className="notes-editor-modern-meta">
            <label className="notes-editor-field notes-editor-field-toned" data-tone={statusOption.tone}>
              <span className="notes-editor-field-label">Status</span>
              <select
                className="notes-input notes-select"
                data-tone={statusOption.tone}
                value={draft.status}
                onChange={(event) => onStatusChange(event.target.value as NoteStatus)}
              >
                {NOTE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="notes-editor-field notes-editor-field-toned" data-tone={priorityOption.tone}>
              <span className="notes-editor-field-label">Prioridade</span>
              <select
                className="notes-input notes-select"
                data-tone={priorityOption.tone}
                value={draft.priority}
                onChange={(event) => onPriorityChange(event.target.value as NotePriority)}
              >
                {NOTE_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="notes-editor-field notes-editor-field-toned notes-editor-color-field" data-tone="neutral">
              <span className="notes-editor-field-label">Cor</span>
              <div className="notes-editor-color-swatches notes-editor-color-swatches-sheet">
                {NOTE_COLORS.map((color) => (
                  <ColorSwatchButton key={color.key} color={color} size="sm" active={draft.color === color.key} onClick={() => onColorChange(color.key)} />
                ))}
              </div>
            </div>
          </div>

          <div className="notes-editor-modern-frame" data-last-action={lastAction ?? undefined}>
            <div className="notes-editor-modern-toolbar">
              <div className="notes-editor-modern-tools">
                {primaryTools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    title={tool.title}
                    className={`notes-editor-tool notes-editor-tool-modern ${activeToolId === tool.id ? "notes-editor-tool-active" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setOpenMenu(null);
                      setActivePanel("write");
                      onApplyTool(tool.id);
                    }}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>

              <div className="notes-editor-modern-actions">
                <button
                  type="button"
                  className={`notes-editor-mode-btn ${activePanel === "preview" ? "notes-editor-mode-btn-active" : ""}`}
                  onClick={() => {
                    setOpenMenu(null);
                    setActivePanel((current) => (current === "preview" ? "write" : "preview"));
                  }}
                >
                  {activePanel === "preview" ? "Voltar" : "Preview"}
                </button>

                <div className="notes-editor-menu-shell">
                  <button
                    type="button"
                    className={`notes-editor-mode-btn ${openMenu === "format" ? "notes-editor-mode-btn-active" : ""}`}
                    onClick={() => setOpenMenu((current) => (current === "format" ? null : "format"))}
                  >
                    Formatar
                  </button>
                  {openMenu === "format" ? (
                    <div className="notes-editor-menu-panel">
                      {advancedTools.map((tool) => (
                        <button
                          key={tool.id}
                          type="button"
                          className={`notes-editor-menu-item ${activeToolId === tool.id ? "notes-editor-menu-item-active" : ""}`}
                          onClick={() => {
                            setOpenMenu(null);
                            setActivePanel("write");
                            onApplyTool(tool.id);
                          }}
                        >
                          <span className="notes-editor-menu-item-label">{tool.label}</span>
                          <span className="notes-editor-menu-item-help">{tool.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="notes-editor-menu-shell">
                  <button
                    type="button"
                    className={`notes-editor-mode-btn ${openMenu === "insert" ? "notes-editor-mode-btn-active" : ""}`}
                    onClick={() => setOpenMenu((current) => (current === "insert" ? null : "insert"))}
                  >
                    Inserir
                  </button>
                  {openMenu === "insert" ? (
                    <div className="notes-editor-menu-panel">
                      {NOTE_SNIPPETS.map((snippet) => (
                        <button
                          key={snippet.id}
                          type="button"
                          className={`notes-editor-menu-item ${activeMarkerLabel === snippet.label ? "notes-editor-menu-item-active" : ""}`}
                          onClick={() => {
                            setOpenMenu(null);
                            setActivePanel("write");
                            onInsertSnippet(snippet);
                          }}
                        >
                          <span className="notes-editor-menu-item-label">{snippet.label}</span>
                          <span className="notes-editor-menu-item-help">{snippet.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="notes-editor-modern-workspace" data-panel={activePanel}>
              <div className={`notes-editor-modern-write ${activePanel === "preview" ? "hidden" : ""}`}>
                <textarea
                  ref={textareaRef}
                  rows={10}
                  className="notes-input notes-textarea notes-textarea-modern resize-none"
                  placeholder="Escreva a nota. Use os atalhos acima para estruturar o texto sem perder foco."
                  value={draft.content}
                  onChange={(event) => onContentChange(event.target.value)}
                />
                <div className="notes-editor-meta notes-editor-meta-modern">
                  <span className="notes-card-inline-label">Conteudo</span>
                  <span className="notes-card-counter">{draft.content.length} caracteres</span>
                </div>
              </div>

              {activePanel === "preview" ? (
                <div className="notes-editor-modern-preview">
                  <div className="notes-editor-live-header">
                    <span className="notes-card-inline-label">Visualizacao</span>
                    <span className="notes-card-counter">Renderizacao atual da nota</span>
                  </div>
                  <div className="notes-editor-preview-surface notes-editor-preview-surface-modern">{renderRichContent(draft.content)}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="notes-actions-bar notes-actions-bar-sheet mt-4">
        <div className="notes-actions-main">
          <button type="button" onClick={onSave} disabled={saving} className="notes-btn-primary">
            <FiSave size={12} /> {saving ? "Salvando..." : "Salvar"}
          </button>
          <button type="button" onClick={onCancel} className="notes-btn-ghost">
            <FiX size={12} /> Cancelar
          </button>
        </div>

        <div className="notes-actions-secondary">
          {onCopy ? (
            <button type="button" onClick={onCopy} className="notes-icon-action" title="Copiar nota" aria-label="Copiar nota">
              <FiCopy size={14} />
            </button>
          ) : null}
          {onExport ? (
            <button type="button" onClick={onExport} className="notes-icon-action" title="Exportar PDF" aria-label="Exportar nota em PDF">
              <FiDownload size={14} />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="notes-icon-action notes-icon-action-danger"
              title="Excluir nota"
              aria-label="Excluir nota"
            >
              <FiTrash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}

export default function NotesButton({ defaultOpen = false }: NotesButtonProps) {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(defaultOpen);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [, setSaveStatus] = useState<"idle" | "saving" | "saved" | "dirty">("idle");
  const [editorLastAction, setEditorLastAction] = useState<string | null>(null);
  const [editorActiveTool, setEditorActiveTool] = useState<EditorTool["id"] | null>(null);
  const [editorActiveMarker, setEditorActiveMarker] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedColor, setSelectedColor] = useState<NoteColorKey>(NOTE_COLORS[0].key);
  const [colorFilter, setColorFilter] = useState<NoteFilterValue<NoteColorKey>>("all");
  const [statusFilter, setStatusFilter] = useState<NoteFilterValue<NoteStatus>>("all");
  const [priorityFilter, setPriorityFilter] = useState<NoteFilterValue<NotePriority>>("all");
  const [minimized, setMinimized] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [manualWidth, setManualWidth] = useState<number | null>(null);
  const [manualHeight, setManualHeight] = useState<number | null>(null);

  const dragging = useRef(false);
  const resizing = useRef<null | "width" | "height" | "both">(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isCreating = editingId === "new";
  const storageKey = user ? `qc:user_notes:${user.id}` : null;
  const isEditorMode = Boolean(editingId && draft);
  const widgetMinWidth = isEditorMode ? NOTES_WIDGET_MIN_WIDTH_EDITING : NOTES_WIDGET_MIN_WIDTH;
  const widgetBaseWidth = isEditorMode ? NOTES_WIDGET_EDIT_WIDTH : NOTES_WIDGET_VIEW_WIDTH;
  const widgetMinHeight = isEditorMode ? NOTES_WIDGET_MIN_HEIGHT_EDITING : NOTES_WIDGET_MIN_HEIGHT;
  const widgetBaseHeight = isEditorMode ? NOTES_WIDGET_EDIT_HEIGHT : NOTES_WIDGET_VIEW_HEIGHT;
  const editorModeWidth = clampWidgetWidth(manualWidth ?? widgetBaseWidth, widgetMinWidth);
  const editorModeHeight = clampWidgetHeight(manualHeight ?? widgetBaseHeight, widgetMinHeight);

  useEffect(() => {
    const savedWidth = loadWidgetWidth();
    if (typeof savedWidth === "number") {
      setManualWidth(clampWidgetWidth(savedWidth, NOTES_WIDGET_MIN_WIDTH));
    }
    const savedHeight = loadWidgetHeight();
    if (typeof savedHeight === "number") {
      setManualHeight(clampWidgetHeight(savedHeight, NOTES_WIDGET_MIN_HEIGHT));
    }

    const savedPos = loadWidgetPos();
    if (savedPos) {
      const initialWidth = clampWidgetWidth(savedWidth ?? NOTES_WIDGET_VIEW_WIDTH, NOTES_WIDGET_MIN_WIDTH);
      const initialHeight = clampWidgetHeight(savedHeight ?? NOTES_WIDGET_VIEW_HEIGHT, NOTES_WIDGET_MIN_HEIGHT);
      const maxX = Math.max(0, window.innerWidth - initialWidth);
      const maxY = Math.max(0, window.innerHeight - initialHeight);
      if (savedPos.x >= 0 && savedPos.x <= maxX && savedPos.y >= 0 && savedPos.y <= maxY) {
        setPos(savedPos);
      } else {
        saveWidgetPos({
          x: Math.max(0, Math.min(savedPos.x, maxX)),
          y: Math.max(0, Math.min(savedPos.y, maxY)),
        });
      }
    }

    const savedState = loadWidgetState();
    setMinimized(defaultOpen ? false : savedState.minimized);
    setPinned(savedState.pinned);
  }, [defaultOpen]);

  useEffect(() => {
    saveWidgetState({ minimized, pinned });
  }, [minimized, pinned]);

  useEffect(() => {
    if (manualWidth == null) return;
    saveWidgetWidth(manualWidth);
  }, [manualWidth]);

  useEffect(() => {
    if (manualHeight == null) return;
    saveWidgetHeight(manualHeight);
  }, [manualHeight]);

  useEffect(() => {
    if (!editorActiveTool && !editorActiveMarker) return;
    const timeout = window.setTimeout(() => {
      setEditorActiveTool(null);
      setEditorActiveMarker(null);
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [editorActiveMarker, editorActiveTool]);

  useEffect(() => {
    setManualWidth((current) => {
      if (current == null) return current;
      const clamped = clampWidgetWidth(current, widgetMinWidth);
      return clamped === current ? current : clamped;
    });
    setManualHeight((current) => {
      if (current == null) return current;
      const clamped = clampWidgetHeight(current, widgetMinHeight);
      return clamped === current ? current : clamped;
    });
  }, [widgetMinHeight, widgetMinWidth]);

  useEffect(() => {
    if (!pos) return;

    const maxX = Math.max(8, window.innerWidth - editorModeWidth - 8);
    const maxY = Math.max(8, window.innerHeight - 160);
    const nextPos = {
      x: Math.max(8, Math.min(pos.x, maxX)),
      y: Math.max(8, Math.min(pos.y, maxY)),
    };

    if (nextPos.x !== pos.x || nextPos.y !== pos.y) {
      setPos(nextPos);
      saveWidgetPos(nextPos);
    }
  }, [editorModeWidth, pos]);

  const readLocalNotes = useCallback((): NoteItem[] => {
    if (!storageKey || typeof window === "undefined") return [];
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map((item) => normalizeNoteItem(item)) : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  const writeLocalNotes = useCallback(
    (items: NoteItem[]) => {
      if (!storageKey || typeof window === "undefined") return;
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(items));
      } catch {
        // noop
      }
    },
    [storageKey],
  );

  const mergeNotes = useCallback((serverItems: NoteItem[], localItems: NoteItem[]) => {
    const map = new Map<string, NoteItem>();
    serverItems.forEach((item) => {
      if (item?.id) map.set(item.id, normalizeNoteItem(item));
    });
    localItems.forEach((item) => {
      if (item?.id && !map.has(item.id)) map.set(item.id, normalizeNoteItem(item));
    });
    return Array.from(map.values()).sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
  }, []);

  const upsertLocalNote = useCallback(
    (note: NoteItem) => {
      const normalized = normalizeNoteItem(note);
      const current = readLocalNotes();
      const next = [normalized, ...current.filter((item) => item.id !== normalized.id)].sort((left, right) =>
        left.updatedAt < right.updatedAt ? 1 : -1,
      );
      writeLocalNotes(next);
      setNotes(next);
    },
    [readLocalNotes, writeLocalNotes],
  );

  const removeLocalNote = useCallback(
    (noteId: string) => {
      const current = readLocalNotes();
      const next = current.filter((item) => item.id !== noteId);
      writeLocalNotes(next);
      setNotes(next);
    },
    [readLocalNotes, writeLocalNotes],
  );

  useEffect(() => {
    setNotes([]);
    setError(null);
    setMessage(null);
    setEditingId(null);
    setExpandedId(null);
    setDraft(null);
  }, [storageKey]);

  useEffect(() => {
    if (pinned || !open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, pinned]);

  useEffect(() => {
    if (!open || pinned) return undefined;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open, pinned]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && draft) {
        event.preventDefault();
        void saveDraft();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const loadNotes = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    const localItems = readLocalNotes();
    if (localItems.length > 0) setNotes(localItems);

    try {
      const response = await fetch("/api/notes", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as { items?: NoteItem[]; error?: string };

      if (!response.ok) {
        if (!localItems.length) setNotes([]);
        setError(payload?.error || "Erro ao carregar notas");
        return;
      }

      const serverItems = Array.isArray(payload.items) ? payload.items.map((item) => normalizeNoteItem(item)) : [];
      const merged = mergeNotes(serverItems, localItems);
      setNotes(merged);
      writeLocalNotes(merged);
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : "Erro ao carregar notas";
      if (!localItems.length) setNotes([]);
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [mergeNotes, readLocalNotes, user, writeLocalNotes]);

  useEffect(() => {
    if (open) void loadNotes();
  }, [open, loadNotes]);

  useEffect(() => {
    if (!message) return undefined;

    const timeoutId = window.setTimeout(() => {
      setMessage((current) => (current === message ? null : current));
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    if (!error) return undefined;

    const timeoutId = window.setTimeout(() => {
      setError((current) => (current === error ? null : current));
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [error]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes.filter((note) => {
      const matchArchiveVisibility = statusFilter === "Arquivado" ? note.status === "Arquivado" : note.status !== "Arquivado";
      const matchSearch = query
        ? [note.title, note.content, note.status, note.priority, note.color, getNoteColorLabel(note.color)]
            .join("\n")
            .toLowerCase()
            .includes(query)
        : true;
      const matchStatus = statusFilter === "all" ? true : note.status === statusFilter;
      const matchPriority = priorityFilter === "all" ? true : note.priority === priorityFilter;
      const matchColor = colorFilter === "all" ? true : note.color === colorFilter;
      return matchArchiveVisibility && matchSearch && matchStatus && matchPriority && matchColor;
    });
  }, [colorFilter, notes, priorityFilter, search, statusFilter]);
  const editingNote = useMemo(
    () => (editingId && editingId !== "new" ? notes.find((note) => note.id === editingId) ?? null : null),
    [editingId, notes],
  );

  const setDraftTitle = useCallback((value: string) => {
    setDraft((current) => (current ? { ...current, title: value } : current));
    setSaveStatus("dirty");
  }, []);

  const setDraftContent = useCallback((value: string) => {
    setDraft((current) => (current ? { ...current, content: value } : current));
    setSaveStatus("dirty");
  }, []);

  const setDraftColor = useCallback((color: NoteColorKey) => {
    setSelectedColor(color);
    setDraft((current) => (current ? { ...current, color } : current));
    setSaveStatus("dirty");
  }, []);

  const setDraftStatus = useCallback((status: NoteStatus) => {
    setDraft((current) => (current ? { ...current, status } : current));
    setSaveStatus("dirty");
  }, []);

  const setDraftPriority = useCallback((priority: NotePriority) => {
    setDraft((current) => (current ? { ...current, priority } : current));
    setSaveStatus("dirty");
  }, []);

  const startCreate = useCallback(
    (color: NoteColorKey = selectedColor) => {
      setMessage(null);
      setError(null);
      setEditorLastAction(null);
      setEditorActiveTool(null);
      setEditorActiveMarker(null);
      setSelectedColor(color);
      setEditingId("new");
      setExpandedId(null);
      setDraft(createDraft(color));
      setSaveStatus("dirty");
      setMinimized(false);
    },
    [selectedColor],
  );

  const handlePaletteColorSelect = useCallback(
    (color: NoteColorKey) => {
      setColorFilter((current) => (current === color ? "all" : color));
    },
    [],
  );

  const applyDraftTransform = useCallback(
    (transformer: (context: TextTransformContext) => TextTransformResult | null) => {
      if (!draft) return false;

      const textarea = draftTextareaRef.current;
      const start = textarea?.selectionStart ?? draft.content.length;
      const end = textarea?.selectionEnd ?? draft.content.length;
      const context: TextTransformContext = {
        value: draft.content,
        start,
        end,
        selected: draft.content.slice(start, end),
      };
      const result = transformer(context);

      if (!result) return false;

      setDraft((current) => (current ? { ...current, content: result.value } : current));
      setSaveStatus("dirty");

      window.requestAnimationFrame(() => {
        const activeTextarea = draftTextareaRef.current;
        if (!activeTextarea) return;
        activeTextarea.focus();
        activeTextarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      });

      return true;
    },
    [draft],
  );

  const applyEditorTool = useCallback(
    (toolId: EditorTool["id"]) => {
      setError(null);
      setMessage(null);

      const applied = applyDraftTransform((context) => {
        switch (toolId) {
          case "h1":
            return toggleLinePrefix(context, "# ");
          case "h2":
            return toggleLinePrefix(context, "## ");
          case "h3":
            return toggleLinePrefix(context, "### ");
          case "list":
            return toggleLinePrefix(context, "- ");
          case "orderedList":
            return toggleLinePrefix(context, "1. ");
          case "checklist":
            return toggleLinePrefix(context, "- [ ] ");
          case "quote":
            return toggleLinePrefix(context, "> ");
          case "divider":
            return insertDivider(context);
          case "bold":
            return wrapSelection(context, "**", "**", "texto em destaque");
          case "italic":
            return wrapSelection(context, "_", "_", "texto leve");
          case "highlight":
            return wrapSelection(context, "==", "==", "ponto importante");
          case "code":
            return wrapFencedBlock(context, "ts", "const status = 'ok';");
          case "json":
            return formatJsonTransform(context);
          case "link":
            return wrapSelection(context, "[", "](https://exemplo.com)", "link util");
          default:
            return null;
        }
      });

      if (!applied && toolId === "json") {
        setError("Selecione um JSON valido para formatar ou use o bloco JSON como modelo.");
        setEditorLastAction("Nao foi possivel formatar o JSON selecionado.");
        setEditorActiveTool(toolId);
        setEditorActiveMarker(null);
        return;
      }

      if (applied) {
        setEditorLastAction(getEditorToolFeedback(toolId));
        setEditorActiveTool(toolId);
        setEditorActiveMarker(null);
      }
    },
    [applyDraftTransform],
  );

  const insertSnippet = useCallback(
    (snippet: NoteSnippet) => {
      applyDraftTransform((context) => insertText(context, snippet.text));
      setEditorLastAction(getSnippetFeedback(snippet.label));
      setEditorActiveTool(null);
      setEditorActiveMarker(snippet.label);
    },
    [applyDraftTransform],
  );

  function startEdit(note: NoteItem) {
    setMessage(null);
    setError(null);
    setEditorLastAction(null);
    setEditorActiveTool(null);
    setEditorActiveMarker(null);
    setSelectedColor(note.color);
    setEditingId(note.id);
    setExpandedId(note.id);
    setDraft({
      title: note.title,
      content: note.content,
      color: note.color,
      status: note.status,
      priority: note.priority,
    });
    setSaveStatus("dirty");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setSaveStatus("idle");
    setEditorLastAction(null);
    setEditorActiveTool(null);
    setEditorActiveMarker(null);
  }

  async function saveDraft() {
    if (!draft) return;

    setSaving(true);
    setSaveStatus("saving");
    setError(null);
    setMessage(null);

    try {
      if (isCreating) {
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draft),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError((payload as { error?: string })?.error || "Erro ao criar nota");
          setSaveStatus("dirty");
          return;
        }
        if ((payload as { item?: NoteItem }).item) upsertLocalNote(normalizeNoteItem((payload as { item: NoteItem }).item));
        setMessage("Nota criada.");
      } else if (editingId) {
        const response = await fetch(`/api/notes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draft),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError((payload as { error?: string })?.error || "Erro ao atualizar nota");
          setSaveStatus("dirty");
          return;
        }
        if ((payload as { item?: NoteItem }).item) upsertLocalNote(normalizeNoteItem((payload as { item: NoteItem }).item));
        setMessage("Nota atualizada.");
      }

      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 2000);
      setEditingId(null);
      setDraft(null);
      await loadNotes();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar nota");
      setSaveStatus("dirty");
    } finally {
      setSaving(false);
    }
  }

  async function copyNote(note: Pick<NoteItem, "title" | "content" | "status" | "priority" | "updatedAt" | "createdAt">) {
    setError(null);
    setMessage(null);

    const text = formatNoteForClipboard(note);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("Falha ao copiar");
      }

      setMessage("Nota copiada com sucesso.");
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Nao foi possivel copiar a nota");
    }
  }

  async function exportNotePdf(note: Pick<NoteItem, "title" | "content" | "status" | "priority" | "updatedAt" | "createdAt">) {
    setError(null);
    setMessage(null);

    try {
      const [{ jsPDF }, logoDataUrl] = await Promise.all([import("jspdf"), getTestingLogoDataUrl()]);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 48;
      const contentWidth = pageWidth - marginX * 2;
      const exportTimestamp = formatNoteDateFull(new Date().toISOString());
      const labelWidth = 88;
      const valueX = marginX + labelWidth + 18;
      let cursorY = 56;

      const drawFooter = (pageNumber: number) => {
        const footerY = pageHeight - 30;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.8);
        doc.line(marginX, footerY - 28, pageWidth - marginX, footerY - 28);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Gerado por Testing Company", marginX, footerY - 12);
        doc.text("Quality Control | Painel QA", marginX, footerY);
        doc.text(`Exportado em ${exportTimestamp}`, pageWidth - marginX, footerY - 12, { align: "right" });
        doc.text(`Pagina ${pageNumber}`, pageWidth - marginX, footerY, { align: "right" });
      };

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", marginX, cursorY - 8, 34, 34);
      }

      doc.setTextColor(11, 26, 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Testing Company", marginX + 44, cursorY + 10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(102, 112, 133);
      doc.text("Quality Control | Painel QA | Bloco de notas", marginX + 44, cursorY + 26);

      cursorY += 48;
      doc.setDrawColor(239, 0, 1);
      doc.setLineWidth(1);
      doc.line(marginX, cursorY, pageWidth - marginX, cursorY);

      cursorY += 28;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(note.title || "Sem titulo", contentWidth);
      doc.text(titleLines, marginX, cursorY);
      cursorY += titleLines.length * 24 + 8;

      const metaRows = [
        ["Data", formatNoteDateFull(note.updatedAt || note.createdAt)],
        ["Status", getStatusOption(note.status).label],
        ["Prioridade", getPriorityOption(note.priority).label],
      ];

      metaRows.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(239, 0, 1);
        doc.text(label, marginX + labelWidth, cursorY, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        const wrappedValue = doc.splitTextToSize(value, contentWidth - labelWidth - 18);
        doc.text(wrappedValue, valueX, cursorY);
        cursorY += Math.max(20, wrappedValue.length * 15);
      });

      cursorY += 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(11, 26, 60);
      doc.text("Descricao", marginX, cursorY);
      cursorY += 18;

      const contentLines = doc.splitTextToSize(getPlainNoteContent(note.content) || "Sem descricao.", contentWidth - 32);
      const lineHeight = 16;
      let lineIndex = 0;

      while (lineIndex < contentLines.length) {
        if (cursorY > pageHeight - 120) {
          doc.addPage();
          cursorY = 56;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11.5);
          doc.setTextColor(11, 26, 60);
          doc.text("Descricao (continua)", marginX, cursorY);
          cursorY += 18;
        }

        const availableHeight = pageHeight - 120 - cursorY;
        const linesPerPage = Math.max(1, Math.floor((availableHeight - 26) / lineHeight));
        const chunk = contentLines.slice(lineIndex, lineIndex + linesPerPage);
        const boxHeight = chunk.length * lineHeight + 26;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, cursorY - 12, contentWidth, boxHeight, 12, 12, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(31, 41, 55);
        doc.text(chunk, marginX + 16, cursorY + 8);

        cursorY += boxHeight + 18;
        lineIndex += chunk.length;

        if (lineIndex < contentLines.length) {
          doc.addPage();
          cursorY = 56;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11.5);
          doc.setTextColor(11, 26, 60);
          doc.text("Descricao (continua)", marginX, cursorY);
          cursorY += 18;
        }
      }

      const totalPages = doc.getNumberOfPages();
      for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
        doc.setPage(pageIndex);
        drawFooter(pageIndex);
      }

      const fileNameBase = (note.title || "nota")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
      doc.save(`${fileNameBase || "nota"}-quality-control.pdf`);
      setMessage("PDF exportado com sucesso.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Nao foi possivel exportar a nota em PDF");
    }
  }

  async function deleteNote(noteId: string) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError((payload as { error?: string })?.error || "Erro ao excluir nota");
        return;
      }

      removeLocalNote(noteId);
      setMessage("Nota excluida.");
      if (expandedId === noteId) setExpandedId(null);
      if (editingId === noteId) cancelEdit();
      await loadNotes();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao excluir nota");
    } finally {
      setSaving(false);
    }
  }

  function onDragStart(event: ReactMouseEvent) {
    dragging.current = true;
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }
    event.preventDefault();
  }

  function onResizeStart(mode: "width" | "height" | "both", event: ReactMouseEvent) {
    resizing.current = mode;
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      resizeStart.current = {
        x: event.clientX,
        y: event.clientY,
        width: rect.width,
        height: rect.height,
      };
    }
    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(() => {
    function onMove(event: MouseEvent) {
      if (resizing.current) {
        const deltaX = event.clientX - resizeStart.current.x;
        const deltaY = event.clientY - resizeStart.current.y;

        if (resizing.current === "width" || resizing.current === "both") {
          setManualWidth(clampWidgetWidth(resizeStart.current.width + deltaX, widgetMinWidth));
        }

        if (resizing.current === "height" || resizing.current === "both") {
          setManualHeight(clampWidgetHeight(resizeStart.current.height + deltaY, widgetMinHeight));
        }
        return;
      }

      if (!dragging.current) return;

      const panelWidth = panelRef.current?.offsetWidth ?? editorModeWidth;
      const panelHeight = panelRef.current?.offsetHeight ?? editorModeHeight;
      const nextX = Math.max(8, Math.min(event.clientX - dragOffset.current.x, window.innerWidth - panelWidth - 8));
      const nextY = Math.max(8, Math.min(event.clientY - dragOffset.current.y, window.innerHeight - panelHeight - 8));
      const nextPos = { x: nextX, y: nextY };
      setPos(nextPos);
      saveWidgetPos(nextPos);
    }

    function onUp() {
      dragging.current = false;
      resizing.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [editorModeHeight, editorModeWidth, widgetMinHeight, widgetMinWidth]);

  if (!user) return null;

  const activeToast = error
    ? { tone: "error" as const, title: "Atencao", text: error }
    : message
      ? { tone: "success" as const, title: "Confirmado", text: message }
      : null;

  const panelStyle: CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, zIndex: NOTES_WIDGET_Z_INDEX, width: `min(${editorModeWidth}px, calc(100vw - 1rem))`, height: minimized ? undefined : `min(${editorModeHeight}px, calc(100vh - 0.5rem))`, maxHeight: "calc(100vh - 0.5rem)" }
    : pinned
      ? { position: "fixed", bottom: "5rem", right: "1.5rem", zIndex: NOTES_WIDGET_Z_INDEX, width: `min(${editorModeWidth}px, calc(100vw - 1rem))`, height: minimized ? undefined : `min(${editorModeHeight}px, calc(100vh - 0.5rem))`, maxHeight: "calc(100vh - 0.5rem)" }
      : { zIndex: NOTES_WIDGET_Z_INDEX, width: `min(${editorModeWidth}px, calc(100vw - 1rem))`, height: minimized ? undefined : `min(${editorModeHeight}px, calc(100vh - 0.5rem))`, maxHeight: "calc(100vh - 0.5rem)" };
  const statusFilterTone = statusFilter === "all" ? "neutral" : getStatusOption(statusFilter).tone;
  const priorityFilterTone = priorityFilter === "all" ? "neutral" : getPriorityOption(priorityFilter).tone;

  return (
    <div className="relative h-11 w-11 shrink-0 overflow-visible" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Abrir bloco de notas"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb)/70 bg-(--tc-surface,#ffffff) text-(--tc-text,#0f172a) shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-(--tc-accent,#ef0001)/60 hover:text-(--tc-accent,#ef0001)"
      >
        <FiEdit3 size={18} />
        {notes.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--tc-accent,#ef0001) text-[9px] font-black text-white">
            {notes.length > 9 ? "9+" : notes.length}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open && !pinned ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="notes-widget-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            style={panelStyle}
            className={`notes-widget ${isEditorMode ? "notes-widget-editing" : ""} ${pos ? "" : "absolute right-0 mt-2"}`}
          >
            <div className="notes-widget-header cursor-grab active:cursor-grabbing select-none" onMouseDown={onDragStart}>
              <div className="notes-widget-header-main">
                <p className="notes-widget-title">Bloco de notas</p>
              </div>

              <div className="notes-widget-header-controls" onMouseDown={(event) => event.stopPropagation()}>
                <div className="notes-widget-actions">
                  <button
                    type="button"
                    title={minimized ? "Expandir" : "Minimizar"}
                    onClick={() => setMinimized((current) => !current)}
                    className="notes-widget-icon-btn"
                  >
                    {minimized ? <FiMaximize2 size={14} /> : <FiMinus size={14} />}
                  </button>
                  <button
                    type="button"
                    title={pinned ? "Desfixar" : "Fixar na tela"}
                    onClick={() => setPinned((current) => !current)}
                    className={`notes-widget-icon-btn ${pinned ? "text-amber-200" : ""}`}
                  >
                    <FiMapPin size={14} />
                  </button>
                  <button type="button" title="Fechar" onClick={() => setOpen(false)} className="notes-widget-icon-btn hover:text-red-200">
                    <FiX size={15} />
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {!minimized ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden" }}
                  className="notes-widget-body"
                >
                  {!isEditorMode ? (
                    <div className="notes-widget-toolbar">
                      <div className="notes-toolbar-primary">
                        <div className="notes-search-shell">
                          <FiSearch size={15} className="notes-search-icon" />
                          <input
                            type="text"
                            placeholder="Buscar titulo, descricao, conteudo, status, prioridade ou cor"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="notes-search-input"
                          />
                        </div>

                        <button type="button" onClick={() => startCreate()} className="notes-widget-new-btn" title="Nova nota">
                          + Nova
                        </button>
                      </div>

                      <div className="notes-toolbar-color-row">
                        <div className="notes-toolbar-row-head">
                          <span className="notes-filter-label">Cor</span>
                          {colorFilter !== "all" ? (
                            <button type="button" onClick={() => setColorFilter("all")} className="notes-color-filter-reset">
                              Limpar filtro
                            </button>
                          ) : null}
                        </div>

                        <div className="notes-color-filter-bar" role="group" aria-label="Filtrar notas por cor">
                          <button
                            type="button"
                            className={`notes-color-filter-reset-pill ${colorFilter === "all" ? "notes-color-filter-reset-pill-active" : ""}`}
                            onClick={() => setColorFilter("all")}
                          >
                            Todas
                          </button>
                          {NOTE_COLORS.map((color) => (
                            <ColorSwatchButton
                              key={color.key}
                              color={color}
                              active={colorFilter === color.key}
                              onClick={() => handlePaletteColorSelect(color.key)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="notes-toolbar-select-row">
                        <label className="notes-toolbar-select-shell notes-toolbar-select-shell-toned" data-tone={statusFilterTone}>
                          <span className="notes-filter-label">Status</span>
                          <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as NoteFilterValue<NoteStatus>)}
                            data-tone={statusFilterTone}
                            className="notes-input notes-select notes-toolbar-select"
                          >
                            <option value="all">Todos os status</option>
                            {NOTE_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="notes-toolbar-select-shell notes-toolbar-select-shell-toned" data-tone={priorityFilterTone}>
                          <span className="notes-filter-label">Prioridade</span>
                          <select
                            value={priorityFilter}
                            onChange={(event) => setPriorityFilter(event.target.value as NoteFilterValue<NotePriority>)}
                            data-tone={priorityFilterTone}
                            className="notes-input notes-select notes-toolbar-select"
                          >
                            <option value="all">Todas as prioridades</option>
                            {NOTE_PRIORITY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <div className={`notes-widget-scroll px-4 pb-4 ${isEditorMode ? "notes-widget-scroll-editor" : ""}`}>
                    <div className="space-y-3">
                      <AnimatePresence>
                        {isCreating && draft ? (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="notes-card notes-card-editor notes-card-editor-neutral"
                          >
                            <NoteEditor
                              eyebrow={`${getNoteEmoji({ color: draft.color, title: draft.title, content: draft.content })} Nova nota`}
                              draft={draft}
                              saving={saving}
                              lastAction={editorLastAction}
                              activeToolId={editorActiveTool}
                              activeMarkerLabel={editorActiveMarker}
                              onTitleChange={setDraftTitle}
                              onContentChange={setDraftContent}
                              onColorChange={setDraftColor}
                              onStatusChange={setDraftStatus}
                              onPriorityChange={setDraftPriority}
                              onSave={() => void saveDraft()}
                              onCancel={cancelEdit}
                              onApplyTool={applyEditorTool}
                              onInsertSnippet={insertSnippet}
                              textareaRef={draftTextareaRef}
                            />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      {isEditorMode && editingId && editingId !== "new" && draft && editingNote ? (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="notes-card notes-card-editor notes-card-editor-neutral notes-card-editor-standalone"
                        >
                          <NoteEditor
                            eyebrow={`${getNoteEmoji({ color: draft.color, title: draft.title, content: draft.content })} Editando nota`}
                            draft={draft}
                            saving={saving}
                            lastAction={editorLastAction}
                            activeToolId={editorActiveTool}
                            activeMarkerLabel={editorActiveMarker}
                            onTitleChange={setDraftTitle}
                            onContentChange={setDraftContent}
                            onColorChange={setDraftColor}
                            onStatusChange={setDraftStatus}
                            onPriorityChange={setDraftPriority}
                            onSave={() => void saveDraft()}
                            onCancel={cancelEdit}
                            onDelete={() => void deleteNote(editingNote.id)}
                            onCopy={() => void copyNote({ ...editingNote, ...draft })}
                            onExport={() => void exportNotePdf({ ...editingNote, ...draft })}
                            onApplyTool={applyEditorTool}
                            onInsertSnippet={insertSnippet}
                            textareaRef={draftTextareaRef}
                          />
                        </motion.div>
                      ) : null}

                      {!isEditorMode && loading ? <div className="notes-empty-state">Carregando notas...</div> : null}

                      {!isEditorMode && !loading && filteredNotes.length === 0 ? (
                        <div className="notes-empty-state">
                          {search || statusFilter !== "all" || priorityFilter !== "all" || colorFilter !== "all"
                            ? "Nenhuma nota encontrada com os filtros atuais."
                            : "Nenhuma nota criada ainda."}
                        </div>
                      ) : null}

                      {!isEditorMode && !loading
                        ? filteredNotes.map((note) => {
                            const isExpanded = expandedId === note.id;
                            const isEditing = editingId === note.id;
                            const localDraft = isEditing && draft ? draft : null;
                            const liveNote = localDraft ? { ...note, ...localDraft } : note;
                            const noteEmoji = getNoteEmoji(liveNote);
                            const statusOption = getStatusOption(liveNote.status);
                            const priorityOption = getPriorityOption(liveNote.priority);
                            return (
                              <motion.div
                                key={note.id}
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                className={`notes-card ${!isExpanded ? "notes-card-closed" : "notes-card-open"} note-color-${liveNote.color}`}
                                data-status-tone={statusOption.tone}
                                data-priority-tone={priorityOption.tone}
                              >
                                <button
                                  type="button"
                                  onClick={() => setExpandedId((current) => (current === note.id ? null : note.id))}
                                  className="notes-card-trigger"
                                >
                                  <span className="notes-card-icon" aria-hidden>
                                    <span className="notes-card-emoji">{noteEmoji}</span>
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="notes-card-title">{liveNote.title || "Sem titulo"}</p>
                                    <div className="notes-card-meta">
                                      <span className="notes-card-date">{isExpanded ? formatNoteDateFull(note.updatedAt) : formatNoteDate(note.updatedAt)}</span>
                                    </div>
                                    {!isExpanded ? <p className="notes-card-snippet">{getNotePreview(liveNote.content)}</p> : null}
                                    <div className="notes-card-signals">
                                      <span className="notes-card-signal notes-card-badge" data-tone={statusOption.tone}>
                                        {statusOption.label}
                                      </span>
                                      <span className="notes-card-signal notes-card-badge" data-tone={priorityOption.tone}>
                                        {priorityOption.label}
                                      </span>
                                    </div>
                                  </div>
                                  <motion.span
                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                    transition={{ duration: 0.16 }}
                                    className="notes-card-chevron"
                                  >
                                    <FiChevronRight size={15} />
                                  </motion.span>
                                </button>

                                <AnimatePresence initial={false}>
                                  {isExpanded ? (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.18 }}
                                      style={{ overflow: "hidden" }}
                                    >
                                      <div className="notes-card-body">
                                        {isEditing && localDraft ? (
                                          <NoteEditor
                                            eyebrow={`${noteEmoji} Editando nota`}
                                            draft={localDraft}
                                            saving={saving}
                                            lastAction={editorLastAction}
                                            activeToolId={editorActiveTool}
                                            activeMarkerLabel={editorActiveMarker}
                                            onTitleChange={setDraftTitle}
                                            onContentChange={setDraftContent}
                                            onColorChange={setDraftColor}
                                            onStatusChange={setDraftStatus}
                                            onPriorityChange={setDraftPriority}
                                            onSave={() => void saveDraft()}
                                            onCancel={cancelEdit}
                                            onDelete={() => void deleteNote(note.id)}
                                            onCopy={() => void copyNote(liveNote)}
                                            onExport={() => void exportNotePdf(liveNote)}
                                            onApplyTool={applyEditorTool}
                                            onInsertSnippet={insertSnippet}
                                            textareaRef={draftTextareaRef}
                                          />
                                        ) : (
                                          <>
                                            <div className="notes-card-content notes-card-content-detail" data-status-tone={statusOption.tone} data-priority-tone={priorityOption.tone}>
                                              <div className="notes-rich-content">{renderRichContent(note.content)}</div>
                                            </div>
                                              <div className="notes-note-actions">
                                              <div className="notes-note-actions-main">
                                                <button type="button" onClick={() => startEdit(note)} className="notes-note-edit-btn">
                                                  <FiEdit3 size={12} /> Editar
                                                </button>
                                              </div>
                                              <div className="notes-note-actions-tools">
                                                <button
                                                  type="button"
                                                  onClick={() => void copyNote(note)}
                                                  className="notes-icon-action"
                                                  title="Copiar nota"
                                                  aria-label="Copiar nota"
                                                >
                                                  <FiCopy size={14} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => void exportNotePdf(note)}
                                                  className="notes-icon-action"
                                                  title="Exportar nota em PDF"
                                                  aria-label="Exportar nota em PDF"
                                                >
                                                  <FiDownload size={14} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setExpandedId(null)}
                                                  className="notes-icon-action"
                                                  title="Fechar nota"
                                                  aria-label="Fechar nota"
                                                >
                                                  <FiX size={14} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => void deleteNote(note.id)}
                                                  className="notes-icon-action notes-icon-action-danger"
                                                  title="Excluir nota"
                                                  aria-label="Excluir nota"
                                                >
                                                  <FiTrash2 size={14} />
                                                </button>
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </motion.div>
                                  ) : null}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })
                        : null}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <button
              type="button"
              className="notes-widget-resize-handle notes-widget-resize-handle-right"
              onMouseDown={(event) => onResizeStart("width", event)}
              aria-label="Arraste para ajustar largura"
              title="Arraste para ajustar largura"
            />

            <button
              type="button"
              className="notes-widget-resize-handle notes-widget-resize-handle-bottom"
              onMouseDown={(event) => onResizeStart("height", event)}
              aria-label="Arraste para ajustar altura"
              title="Arraste para ajustar altura"
            />

            <button
              type="button"
              className="notes-widget-resize-handle notes-widget-resize-handle-corner"
              onMouseDown={(event) => onResizeStart("both", event)}
              aria-label="Arraste para ajustar largura e altura"
              title="Arraste para ajustar largura e altura"
            />

          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {activeToast ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="notes-toast-layer"
          >
            <div className={`notes-toast notes-toast-${activeToast.tone}`} role="status" aria-live="polite">
              <span className={`notes-toast-icon notes-toast-icon-${activeToast.tone}`} aria-hidden>
                {activeToast.tone === "error" ? <FiAlertCircle size={14} /> : <FiCheck size={14} />}
              </span>
              <div className="min-w-0">
                <p className="notes-toast-title">{activeToast.title}</p>
                <p className="notes-toast-message">{activeToast.text}</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
