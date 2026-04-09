"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { FiChevronLeft, FiChevronRight, FiEdit2, FiLifeBuoy, FiPaperclip, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { useClientContext } from "@/context/ClientContext";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useSuporteKanbanColumns } from "@/hooks/useSuporteKanbanColumns";
import { canAccessGlobalSupportScope, canCreateSupportTickets, canManageSupportWorkflow, canViewSupportBoard } from "@/lib/supportAccess";
import {
  getSuporteStatusLabel,
  normalizeKanbanStatus,
  type SuporteStatus,
} from "@/lib/suportesStatus";
import SuporteDetailsModal from "@/components/SuporteDetailsModal";

type SuporteItem = {
  id: string;
  title: string;
  description: string;
  status: SuporteStatus;
  type?: string | null;
  code?: string | null;
  priority?: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
  companyId?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
};

type ColumnKey = string;
type SupportEvidenceLink = { raw: string; label: string; href: string };

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug" },
  { value: "melhoria", label: "Melhoria" },
  { value: "tarefa", label: "Tarefa" },
];

const SUPPORT_COLUMN_THEMES = ["rose", "sky", "emerald", "amber", "violet", "orange"] as const;
const KNOWN_SUPPORT_ROUTE_ROOTS = new Set([
  "admin",
  "api",
  "login",
  "settings",
  "me",
  "profile",
  "home",
  "dashboard",
  "runs",
  "release",
  "requests",
  "docs",
  "documentos",
  "chamados",
  "meus-chamados",
  "clients",
  "clients-list",
  "integrations",
  "issues",
  "metrics",
  "brand-identity",
  "empresas",
  "kanban-it",
]);
const SUPPORT_EVIDENCE_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function shortText(value?: string | null, max = 120) {
  if (!value) return "Sem descricao.";
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 3))}...`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "-";
  return new Date(time).toLocaleDateString("pt-BR");
}

function hasMeaningfulContent(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Deve conter ao menos uma letra ou dígito
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return false;
  // Rejeita texto onde todos os caracteres (sem espaços) são iguais
  // ex: "çççççççç", "ïïïïïïïïï", "aaaaaaaa"
  const noSpaces = trimmed.replace(/\s+/g, "");
  if (noSpaces.length > 3 && new Set(noSpaces).size <= 1) return false;
  return true;
}

function getSupportTypeLabel(value?: string | null) {
  const normalized = (value ?? "tarefa").toLowerCase();
  return TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? "Tarefa";
}

function getSupportPriorityLabel(value?: string | null) {
  const normalized = (value ?? "medium").toLowerCase();
  return PRIORITY_OPTIONS.find((option) => option.value === normalized)?.label ?? "Média";
}

function normalizeTicketLookup(value?: string | null) {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function extractTicketDigits(value?: string | null) {
  return (value ?? "")
    .toString()
    .replace(/\D+/g, "");
}

function getTicketSearchMeta(query: string, suporte: SuporteItem) {
  const ticketCode = suporte.code || `SP-${suporte.id.slice(0, 6).toUpperCase()}`;
  // Busca apenas pelo código visível ao usuário (ex: SP-000027), não pelo UUID interno
  const normalizedCandidates = [
    normalizeTicketLookup(ticketCode),
  ];
  const digitCandidates = [
    extractTicketDigits(ticketCode),
  ];
  const digitsQuery = extractTicketDigits(query);
  const numericQuery = digitsQuery ? Number(digitsQuery) : Number.NaN;

  let bestScore = -1;
  let hasDirectMatch = false;
  let nearestDistance: number | null = null;

  for (const candidate of normalizedCandidates) {
    if (!candidate) continue;
    if (candidate === query) {
      bestScore = Math.max(bestScore, 1400);
      hasDirectMatch = true;
      continue;
    }
    if (candidate.startsWith(query)) {
      bestScore = Math.max(bestScore, 1220 - (candidate.length - query.length));
      hasDirectMatch = true;
    }
    const includesIndex = candidate.indexOf(query);
    if (includesIndex >= 0) {
      bestScore = Math.max(bestScore, 1040 - includesIndex);
      hasDirectMatch = true;
    }
  }

  if (digitsQuery) {
    for (const candidate of digitCandidates) {
      if (!candidate) continue;

      if (candidate === digitsQuery) {
        bestScore = Math.max(bestScore, 1600);
        hasDirectMatch = true;
      } else {
        if (candidate.endsWith(digitsQuery)) {
          bestScore = Math.max(bestScore, 1480 - (candidate.length - digitsQuery.length));
          hasDirectMatch = true;
        }
        if (candidate.startsWith(digitsQuery)) {
          bestScore = Math.max(bestScore, 1320 - (candidate.length - digitsQuery.length));
          hasDirectMatch = true;
        }
        const includesIndex = candidate.indexOf(digitsQuery);
        if (includesIndex >= 0) {
          bestScore = Math.max(bestScore, 1180 - includesIndex);
          hasDirectMatch = true;
        }
      }

      const numericCandidate = Number(candidate);
      if (Number.isFinite(numericCandidate) && Number.isFinite(numericQuery)) {
        const distance = Math.abs(numericCandidate - numericQuery);
        nearestDistance = nearestDistance === null ? distance : Math.min(nearestDistance, distance);
      }
    }
  }

  return { bestScore, hasDirectMatch, nearestDistance };
}

function getInitials(label: string) {
  const parts = label
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const compact = (parts.length > 1 ? parts.slice(0, 2).map((part) => part[0]) : [label.slice(0, 2)]).join("");
  const normalized = compact.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return normalized || "TC";
}

function sanitizeEvidenceFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
}

function buildEvidenceMarkdown(name: string, url: string) {
  return `[Evidencia: ${name}](${url})`;
}

function isSupportEvidenceLabel(label: string) {
  return /^evid[eê]ncia:/i.test(label.trim());
}

function parseSupportDescription(body?: string | null): { text: string; evidence: SupportEvidenceLink[] } {
  const source = body ?? "";
  if (!source.trim()) {
    return { text: "", evidence: [] };
  }

  const evidence: SupportEvidenceLink[] = [];
  const text = source
    .replace(SUPPORT_EVIDENCE_PATTERN, (raw, label, href) => {
      if (!isSupportEvidenceLabel(label)) return raw;
      evidence.push({ raw, label, href });
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, evidence };
}

function resolveCompanySlugFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "empresas" && parts[2] === "chamados" && parts[1]) {
    return decodeURIComponent(parts[1]);
  }
  if (parts.length >= 2 && parts[1] === "chamados" && !KNOWN_SUPPORT_ROUTE_ROOTS.has(parts[0])) {
    return decodeURIComponent(parts[0]);
  }
  return null;
}

function shouldUseNativeImageTag(src: string) {
  return src.startsWith("/api/s3/object?") || /^(https?:|data:|blob:)/i.test(src);
}

export default function KanbanItPage() {
  const pathname = usePathname() || "";
  const { user, loading } = usePermissionAccess();
  const { companies } = useAuth();
  const { activeClient, activeClientSlug } = useClientContext();
  const [suportes, setSuportes] = useState<SuporteItem[]>([]);
  const [ticketSearch, setTicketSearch] = useState("");
  const [loadingSuportes, setLoadingSuportes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; from: SuporteStatus } | null>(null);
  const [selectedSuporte, setSelectedSuporte] = useState<SuporteItem | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    title: "",
    description: "",
    type: "tarefa",
    priority: "medium",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createEvidenceFile, setCreateEvidenceFile] = useState<File | null>(null);
  const createEvidenceInputRef = useRef<HTMLInputElement | null>(null);

  const [editingColumnKey, setEditingColumnKey] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const columnsRailRef = useRef<HTMLDivElement | null>(null);
  const columnsDragStartXRef = useRef(0);
  const columnsDragStartScrollLeftRef = useRef(0);
  const isDraggingColumnsRef = useRef(false);
  const [canScrollColumnsPrev, setCanScrollColumnsPrev] = useState(false);
  const [canScrollColumnsNext, setCanScrollColumnsNext] = useState(false);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  const [columnDropTargetKey, setColumnDropTargetKey] = useState<string | null>(null);

  const canOpenBoard = canViewSupportBoard(user);
  const canCreateSupport = canCreateSupportTickets(user);
  const hasGlobalScope = canAccessGlobalSupportScope(user);
  const isPrivileged = canManageSupportWorkflow(user);
  const supportBrand = useMemo(() => {
    const routeCompanySlug = resolveCompanySlugFromPath(pathname);
    const preferredSlug =
      routeCompanySlug ??
      activeClientSlug ??
      (typeof user?.clientSlug === "string" ? user.clientSlug : null) ??
      (typeof user?.defaultClientSlug === "string" ? user.defaultClientSlug : null) ??
      null;

    const matchedCompany =
      (preferredSlug ? companies.find((company) => company.slug === preferredSlug) ?? null : null) ??
      (activeClient && activeClient.slug === preferredSlug ? activeClient : null);

    const companyName = matchedCompany?.name ?? (preferredSlug ? preferredSlug.replace(/[-_]+/g, " ") : null);
    const logoSrc =
      typeof matchedCompany?.logoUrl === "string" && matchedCompany.logoUrl.trim()
        ? matchedCompany.logoUrl
        : null;

    return {
      companyName,
      logoSrc,
      logoAlt: companyName ? `Logo da empresa ${companyName}` : "Logo Testing Company",
      logoFallback: getInitials(companyName ?? "Testing Company"),
      isCompanyScoped: Boolean(companyName),
    };
  }, [activeClient, activeClientSlug, companies, pathname, user?.clientSlug, user?.defaultClientSlug]);
  const statusKeys = useMemo(
    () => suportes.map((suporte) => normalizeKanbanStatus(suporte.status)),
    [suportes],
  );
  const { columns, statusOptions, addColumn, renameColumn, removeColumn, moveColumn } = useSuporteKanbanColumns(statusKeys, isPrivileged);

  const filteredSuportes = useMemo(() => {
    const query = normalizeTicketLookup(ticketSearch);
    if (!query) return suportes;

    const ranked = suportes.map((suporte) => ({
      suporte,
      ...getTicketSearchMeta(query, suporte),
    }));

    const directMatches = ranked
      .filter((item) => item.hasDirectMatch)
      .sort((left, right) => {
        if (right.bestScore !== left.bestScore) return right.bestScore - left.bestScore;
        return right.suporte.updatedAt.localeCompare(left.suporte.updatedAt);
      });

    return directMatches.map((item) => item.suporte);
  }, [suportes, ticketSearch]);

  const grouped = useMemo(() => {
    const map: Record<ColumnKey, SuporteItem[]> = {};
    columns.forEach((col) => {
      map[col.key] = [];
    });
    for (const suporte of filteredSuportes) {
      const normalized = normalizeKanbanStatus(suporte.status) as ColumnKey;
      if (map[normalized]) map[normalized].push(suporte);
    }
    return map;
  }, [filteredSuportes, columns]);

  const boardMetrics = useMemo(() => {
    const assignedCount = filteredSuportes.filter((suporte) => Boolean(suporte.assignedToUserId)).length;
    const inProgressCount = filteredSuportes.filter((suporte) => {
      const normalized = normalizeKanbanStatus(suporte.status);
      return normalized === "doing" || normalized === "review";
    }).length;
    const completedCount = filteredSuportes.filter((suporte) => normalizeKanbanStatus(suporte.status) === "done").length;

    return [
      {
        label: "Tickets no painel",
        value: filteredSuportes.length,
        copy: hasGlobalScope
          ? "Tickets ativos no fluxo global de atendimento."
          : "Tickets visiveis no seu painel pessoal de atendimento.",
      },
      {
        label: "Em andamento",
        value: inProgressCount,
        copy: hasGlobalScope
          ? "Tickets em atendimento ou revisao pelo time de suporte."
          : "Seus tickets em atendimento ou revisao no momento.",
      },
      {
        label: "Com responsavel",
        value: assignedCount,
        copy: hasGlobalScope
          ? "Tickets ja vinculados ao time de suporte."
          : "Seus tickets que ja possuem responsavel definido.",
      },
      {
        label: "Concluidos",
        value: completedCount,
        copy: hasGlobalScope
          ? "Tickets finalizados dentro do fluxo de suporte."
          : "Tickets seus que ja foram finalizados no fluxo de suporte.",
      },
    ];
  }, [filteredSuportes, hasGlobalScope]);

  const updateColumnsRailState = useCallback(() => {
    const rail = columnsRailRef.current;
    if (!rail) {
      setCanScrollColumnsPrev(false);
      setCanScrollColumnsNext(false);
      return;
    }

    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    setCanScrollColumnsPrev(rail.scrollLeft > 8);
    setCanScrollColumnsNext(rail.scrollLeft < maxScrollLeft - 8);
  }, []);

  const loadSuportes = useCallback(async () => {
    setLoadingSuportes(true);
    setError(null);
    try {
      const res = await fetch("/api/suportes", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { items?: SuporteItem[]; error?: string };
      if (!res.ok) {
        setSuportes([]);
        setError(json?.error || "Erro ao carregar suportes");
        return;
      }
      setSuportes(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar suportes";
      setError(msg);
    } finally {
      setLoadingSuportes(false);
    }
  }, []);

  useEffect(() => {
    loadSuportes();
  }, [loadSuportes]);

  useEffect(() => {
    const timer = setInterval(loadSuportes, 30000);
    return () => clearInterval(timer);
  }, [loadSuportes]);

  // Auto-scroll ao card encontrado pela busca
  useEffect(() => {
    if (!ticketSearch.trim() || filteredSuportes.length === 0) return;
    const frame = requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>("[data-search-match='true']");
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [filteredSuportes, ticketSearch]);

  useEffect(() => {
    const rail = columnsRailRef.current;
    if (!rail) return;

    const handleRailScroll = () => updateColumnsRailState();
    const handleResize = () => updateColumnsRailState();

    updateColumnsRailState();
    rail.addEventListener("scroll", handleRailScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      rail.removeEventListener("scroll", handleRailScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [columns.length, updateColumnsRailState]);

  function handleDragStart(suporte: SuporteItem) {
    if (!isPrivileged) return;
    setDragging({ id: suporte.id, from: suporte.status });
  }

  async function updateStatus(suporteId: string, nextStatus: SuporteStatus) {
    if (!isPrivileged) return;
    const currentSuporte = suportes.find((suporte) => suporte.id === suporteId) ?? null;
    if (!currentSuporte) return;
    if (hasGlobalScope && !currentSuporte.assignedToUserId) {
      setError("Selecione e salve um responsavel antes de mover o ticket.");
      setSelectedSuporte(currentSuporte);
      return;
    }

    const previous = suportes;
    setSuportes((current) =>
      current.map((suporte) => (suporte.id === suporteId ? { ...suporte, status: nextStatus } : suporte)),
    );
    try {
      const res = await fetch(`/api/suportes/${suporteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: SuporteItem; error?: string };
      if (!res.ok || !json.item) {
        setSuportes(previous);
        setError(json?.error || "Falha ao atualizar status");
        return;
      }
      const updatedItem = json.item;
      setSuportes((current) =>
        current.map((suporte) => (suporte.id === updatedItem.id ? updatedItem : suporte)),
      );
      setSelectedSuporte((current) => (current?.id === updatedItem.id ? updatedItem : current));
    } catch {
      setSuportes(previous);
      setError("Falha ao atualizar status");
    }
  }

  async function handleDrop(toStatus: SuporteStatus) {
    if (!dragging || !isPrivileged) return;
    if (dragging.from === toStatus) {
      setDragging(null);
      return;
    }
    const suporteId = dragging.id;
    setDragging(null);
    await updateStatus(suporteId, toStatus);
  }

  function handleColumnDragStart(key: string) {
    if (!isPrivileged) return;
    setDraggingColumnKey(key);
    setColumnDropTargetKey(null);
  }

  function handleColumnDragEnd() {
    setDraggingColumnKey(null);
    setColumnDropTargetKey(null);
  }

  function handleColumnDragOver(event: ReactDragEvent<HTMLDivElement>, key: string) {
    if (!draggingColumnKey || draggingColumnKey === key) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (columnDropTargetKey !== key) {
      setColumnDropTargetKey(key);
    }
  }

  function handleColumnDrop(targetKey: string) {
    if (!draggingColumnKey) return;
    if (draggingColumnKey !== targetKey) {
      moveColumn(draggingColumnKey, targetKey);
      requestAnimationFrame(() => updateColumnsRailState());
    }
    handleColumnDragEnd();
  }

  async function handleRemoveColumn(columnKey: string) {
    if (!isPrivileged) return;

    const columnIndex = columns.findIndex((column) => column.key === columnKey);
    const remainingColumns = columns.filter((column) => column.key !== columnKey);
    const fallbackColumn = remainingColumns[Math.min(Math.max(columnIndex, 0), Math.max(remainingColumns.length - 1, 0))] ?? null;
    const columnItems = grouped[columnKey] ?? [];

    if (columnItems.length > 0 && !fallbackColumn) {
      setError("Crie outra coluna antes de remover esta, para nao perder os tickets.");
      return;
    }

    if (columnItems.length > 0 && fallbackColumn) {
      const previous = suportes;
      setError(null);
      setSuportes((current) =>
        current.map((suporte) =>
          normalizeKanbanStatus(suporte.status) === columnKey
            ? { ...suporte, status: fallbackColumn.key }
            : suporte,
        ),
      );

      try {
        const movedItems = await Promise.all(columnItems.map(async (suporte) => {
          const res = await fetch(`/api/suportes/${suporte.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: fallbackColumn.key }),
          });
          const json = (await res.json().catch(() => ({}))) as { item?: SuporteItem; error?: string };
          if (!res.ok || !json.item) {
            throw new Error(json?.error || "Falha ao mover tickets da coluna");
          }
          return json.item;
        }));

        const movedMap = new Map(movedItems.map((item) => [item.id, item]));
        setSuportes((current) => current.map((suporte) => movedMap.get(suporte.id) ?? suporte));
        setSelectedSuporte((current) => (current ? movedMap.get(current.id) ?? current : current));
      } catch (err) {
        setSuportes(previous);
        setError(err instanceof Error ? err.message : "Falha ao mover tickets da coluna");
        return;
      }
    }

    removeColumn(columnKey);
    if (editingColumnKey === columnKey) {
      setEditingColumnKey(null);
      setEditingColumnLabel("");
    }
    handleColumnDragEnd();
  }

  async function submitCreate() {
    setCreating(true);
    setCreateError(null);

    const titleTrimmed = createDraft.title.trim();
    if (!titleTrimmed) {
      setCreateError("O titulo nao pode ser vazio.");
      setCreating(false);
      return;
    }
    if (!hasMeaningfulContent(titleTrimmed)) {
      setCreateError("O titulo deve conter pelo menos uma letra ou numero valido.");
      setCreating(false);
      return;
    }
    const descTrimmed = createDraft.description.trim();
    if (descTrimmed && !hasMeaningfulContent(descTrimmed)) {
      setCreateError("A descricao deve conter pelo menos uma letra ou numero valido.");
      setCreating(false);
      return;
    }

    try {
      let evidenceMarkdown = "";
      if (createEvidenceFile) {
        const safeName = sanitizeEvidenceFileName(createEvidenceFile.name || `evidencia-${Date.now()}`);
        const key = `tickets/evidencias/tmp/${Date.now()}-${safeName}`;
        const form = new FormData();
        form.set("file", createEvidenceFile);
        form.set("key", key);
        const uploadRes = await fetch("/api/s3/upload", {
          method: "POST",
          credentials: "include",
          body: form,
        });
        const uploadJson = (await uploadRes.json().catch(() => ({}))) as { ok?: boolean; key?: string; error?: string };
        if (!uploadRes.ok || !uploadJson.ok || !uploadJson.key) {
          setCreateError(uploadJson?.error || "Erro ao anexar evidencia");
          setCreating(false);
          return;
        }
        evidenceMarkdown = buildEvidenceMarkdown(
          createEvidenceFile.name,
          `/api/s3/object?key=${encodeURIComponent(uploadJson.key)}`,
        );
      }

      const description = [createDraft.description.trim(), evidenceMarkdown].filter(Boolean).join("\n\n");

      const res = await fetch("/api/suportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: createDraft.title,
          description,
          type: createDraft.type,
          priority: createDraft.priority,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: SuporteItem; error?: string };
      if (!res.ok || !json.item) {
        setCreateError(json?.error || "Erro ao criar suporte");
        return;
      }
      setCreateOpen(false);
      setCreateDraft({ title: "", description: "", type: "tarefa", priority: "medium" });
      setCreateEvidenceFile(null);
      if (createEvidenceInputRef.current) createEvidenceInputRef.current.value = "";
      setSuportes((current) => [json.item as SuporteItem, ...current]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar suporte";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateError(null);
    setCreateEvidenceFile(null);
    if (createEvidenceInputRef.current) createEvidenceInputRef.current.value = "";
  }

  function startEditColumn(key: string, label: string) {
    if (!isPrivileged) return;
    setEditingColumnKey(key);
    setEditingColumnLabel(label);
  }

  function commitEditColumn() {
    if (!editingColumnKey) return;
    if (!editingColumnLabel.trim()) {
      void handleRemoveColumn(editingColumnKey);
      return;
    }
    renameColumn(editingColumnKey, editingColumnLabel);
    setEditingColumnKey(null);
    setEditingColumnLabel("");
  }

  function cancelEditColumn() {
    setEditingColumnKey(null);
    setEditingColumnLabel("");
  }

  function startAddColumn() {
    if (!isPrivileged) return;
    setAddingColumn(true);
    setNewColumnLabel("");
  }

  function commitAddColumn() {
    const created = addColumn(newColumnLabel);
    setAddingColumn(false);
    setNewColumnLabel("");
    if (created) {
      requestAnimationFrame(() => {
        const rail = columnsRailRef.current;
        if (!rail) return;
        rail.scrollTo({ left: rail.scrollWidth, behavior: "smooth" });
        updateColumnsRailState();
      });
    }
    return created;
  }

  function scrollColumnsRail(direction: "prev" | "next") {
    const rail = columnsRailRef.current;
    if (!rail) return;
    const firstColumn = rail.querySelector<HTMLElement>(".support-board-column");
    const step = (firstColumn?.offsetWidth ?? 320) + 16;
    rail.scrollBy({
      left: direction === "next" ? step : -step,
      behavior: "smooth",
    });
  }

  function handleColumnsWheel(event: WheelEvent<HTMLDivElement>) {
    const rail = columnsRailRef.current;
    if (!rail) return;
    if (rail.scrollWidth <= rail.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    rail.scrollLeft += event.deltaY;
    updateColumnsRailState();
  }

  function handleColumnsPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const rail = columnsRailRef.current;
    if (!rail) return;
    if (rail.scrollWidth <= rail.clientWidth) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, select, textarea, a, [role='button']")) return;

    isDraggingColumnsRef.current = true;
    columnsDragStartXRef.current = event.clientX;
    columnsDragStartScrollLeftRef.current = rail.scrollLeft;
    rail.dataset.dragging = "true";
    rail.setPointerCapture?.(event.pointerId);
  }

  function handleColumnsPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingColumnsRef.current) return;
    const rail = columnsRailRef.current;
    if (!rail) return;

    event.preventDefault();
    const deltaX = event.clientX - columnsDragStartXRef.current;
    rail.scrollLeft = columnsDragStartScrollLeftRef.current - deltaX;
    updateColumnsRailState();
  }

  function handleColumnsPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const rail = columnsRailRef.current;
    if (rail?.hasPointerCapture?.(event.pointerId)) {
      rail.releasePointerCapture(event.pointerId);
    }
    isDraggingColumnsRef.current = false;
    if (rail) delete rail.dataset.dragging;
  }

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!canOpenBoard) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return (
    <div className="support-board-page">
      <section className="support-board-hero">
        <div className="support-board-hero-brand">
          <div className="support-board-hero-logo">
            {supportBrand.logoSrc ? (
              shouldUseNativeImageTag(supportBrand.logoSrc) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={supportBrand.logoSrc}
                  alt={supportBrand.logoAlt}
                  width={72}
                  height={72}
                  className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <Image
                  src={supportBrand.logoSrc}
                  alt={supportBrand.logoAlt}
                  width={72}
                  height={72}
                  className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                  priority
                />
              )
            ) : supportBrand.isCompanyScoped ? (
              <span className="text-lg font-bold tracking-[0.18em] text-white/90 sm:text-xl">
                {supportBrand.logoFallback}
              </span>
            ) : (
              <Image src="/images/tc.png" alt="Logo Testing Company" width={72} height={72} className="h-14 w-14 object-contain sm:h-16 sm:w-16" priority />
            )}
          </div>
          <div className="min-w-0">
            {supportBrand.companyName ? <p className="support-board-kicker">EMPRESA {supportBrand.companyName.toUpperCase()}</p> : null}
            <h1 className="support-board-title">Suporte</h1>
          </div>
        </div>

        <div className="support-board-hero-top">
          <div className="support-board-hero-copy">
            <p className="support-board-subtitle">
              {hasGlobalScope
                ? "Acompanhe os tickets do atendimento tecnico em um fluxo direto."
                : supportBrand.companyName
                  ? `Acompanhe os tickets visiveis de ${supportBrand.companyName} no fluxo de suporte.`
                  : "Acompanhe apenas os tickets criados por voce no fluxo de suporte."}
            </p>
          </div>

          {canCreateSupport ? (
            <div className="support-board-hero-actions">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="support-board-accent-btn"
                aria-label="Criar suporte"
              >
                <FiPlus size={18} />
                Novo suporte
              </button>
            </div>
          ) : null}
        </div>

        <div className="support-board-stat-grid">
          {boardMetrics.map((item) => (
            <article key={item.label} className="support-board-stat">
              <div className="support-board-stat-label">{item.label}</div>
              <div className="support-board-stat-value">{item.value}</div>
              <div className="support-board-stat-copy">{item.copy}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="support-board-workspace">
        <div className="support-board-workspace-head">
          <div className="support-board-workspace-copy">
            <p className="support-board-section-kicker">Painel de atendimento</p>
            <h2 className="support-board-section-title">
              {hasGlobalScope ? "Kanban de suporte" : "Seus tickets"}
            </h2>
            <p className="support-board-section-description">
              {hasGlobalScope
                ? "Organize colunas, acompanhe responsaveis e abra o detalhamento do ticket."
                : "Acompanhe seus tickets, responda e consulte o historico."}
            </p>
          </div>

          <div className="support-board-workspace-side">
            <div className="support-board-toolbar">
              {isPrivileged && user?.id ? (
                <>
                  {!addingColumn && (
                    <button
                      type="button"
                      onClick={startAddColumn}
                      className="support-board-toolbar-btn"
                    >
                      <FiPlus size={13} />
                      Nova coluna
                    </button>
                  )}
                  {addingColumn && (
                    <input
                      value={newColumnLabel}
                      autoFocus
                      onChange={(e) => setNewColumnLabel(e.target.value)}
                      onBlur={commitAddColumn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitAddColumn();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setAddingColumn(false);
                          setNewColumnLabel("");
                        }
                      }}
                      className="support-board-column-input"
                      placeholder="Nome da coluna"
                    />
                  )}
                </>
              ) : null}
            </div>

            <div className="support-board-search-card">
              <div className="support-board-search-label">Busca</div>
              <div className="support-board-search-field">
                <FiSearch size={15} className="support-board-search-icon" />
                <input
                  type="search"
                  value={ticketSearch}
                  onChange={(event) => setTicketSearch(event.target.value)}
                  className="support-board-search-input"
                  placeholder="ID ou codigo do ticket"
                  aria-label="Buscar ticket por ID"
                />
              </div>
              <div className="support-board-meta-row" aria-label="Informacoes do painel">
                <span className="support-board-meta-item">
                  {columns.length} {columns.length === 1 ? "coluna ativa" : "colunas ativas"}
                </span>
                {dragging ? <span className="support-board-meta-item support-board-meta-item-accent">Movimentacao em andamento</span> : null}
              </div>
            </div>
          </div>
        </div>

        {error ? <p className="support-board-alert support-board-alert-error">{error}</p> : null}
        {loadingSuportes ? <p className="support-board-alert">Carregando tickets...</p> : null}
        {ticketSearch.trim() && filteredSuportes.length === 0 && !loadingSuportes ? (
          <div className="support-board-no-results">
            <FiSearch size={18} className="support-board-no-results-icon" />
            <span>Nenhum ticket encontrado para <strong>&ldquo;{ticketSearch.trim()}&rdquo;</strong>. Verifique o ID ou codigo e tente novamente.</span>
          </div>
        ) : null}

        <div className="support-board-columns-stage">
          <div className="support-board-carousel-controls support-board-carousel-controls-side" aria-label="Navegacao das colunas">
            <button
              type="button"
              className="support-board-carousel-btn support-board-carousel-btn-side support-board-carousel-btn-prev"
              onClick={() => scrollColumnsRail("prev")}
              disabled={!canScrollColumnsPrev}
              aria-label="Ver colunas anteriores"
              title="Ver colunas anteriores"
            >
              <FiChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="support-board-carousel-btn support-board-carousel-btn-side support-board-carousel-btn-next"
              onClick={() => scrollColumnsRail("next")}
              disabled={!canScrollColumnsNext}
              aria-label="Ver proximas colunas"
              title="Ver proximas colunas"
            >
              <FiChevronRight size={16} />
            </button>
          </div>

          <div
            ref={columnsRailRef}
            className="support-board-columns-shell"
            onWheel={handleColumnsWheel}
            onPointerDown={handleColumnsPointerDown}
            onPointerMove={handleColumnsPointerMove}
            onPointerUp={handleColumnsPointerEnd}
            onPointerCancel={handleColumnsPointerEnd}
            onPointerLeave={handleColumnsPointerEnd}
          >
        <div className="support-board-columns">
          {columns.map((column, idx) => {
            const columnTheme = SUPPORT_COLUMN_THEMES[idx % SUPPORT_COLUMN_THEMES.length];
            const columnItems = grouped[column.key] ?? [];
            const isDropTarget = Boolean(dragging && dragging.from !== column.key && isPrivileged);
            const isColumnDropTarget = Boolean(draggingColumnKey && draggingColumnKey !== column.key && columnDropTargetKey === column.key);
            const isDraggingColumn = draggingColumnKey === column.key;

            return (
              <div
                key={column.key}
                className="support-board-column"
                data-theme={columnTheme}
                data-active-drop={isDropTarget ? "true" : undefined}
                data-column-drop={isColumnDropTarget ? "true" : undefined}
                data-column-dragging={isDraggingColumn ? "true" : undefined}
                onDragOver={isPrivileged ? (e) => {
                  if (draggingColumnKey) {
                    handleColumnDragOver(e, column.key);
                    return;
                  }
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                } : undefined}
                onDrop={isPrivileged ? () => {
                  if (draggingColumnKey) {
                    handleColumnDrop(column.key);
                    return;
                  }
                  handleDrop(column.key);
                } : undefined}
              >
                <div className="support-board-column-head">
                  <div
                    className="support-board-column-head-main"
                    draggable={isPrivileged && editingColumnKey !== column.key}
                    onDragStart={isPrivileged ? (event) => {
                      event.dataTransfer.setData("text/column-key", column.key);
                      event.dataTransfer.effectAllowed = "move";
                      handleColumnDragStart(column.key);
                    } : undefined}
                    onDragEnd={isPrivileged ? handleColumnDragEnd : undefined}
                    title={isPrivileged ? `Segure e arraste para mover a coluna ${column.label}` : undefined}
                  >
                    <div className="support-board-column-head-copy">
                      <p className="support-board-column-kicker">Coluna</p>
                      {editingColumnKey === column.key ? (
                        <input
                          value={editingColumnLabel}
                          autoFocus
                          onChange={(e) => setEditingColumnLabel(e.target.value)}
                          onBlur={commitEditColumn}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitEditColumn();
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEditColumn();
                            }
                          }}
                          placeholder="Nome da coluna"
                          title="Editar nome da coluna"
                          aria-label="Editar nome da coluna"
                          className="support-board-column-title-input"
                        />
                      ) : isPrivileged ? (
                        <button
                          type="button"
                          draggable={false}
                          onClick={() => startEditColumn(column.key, column.label)}
                          className="support-board-column-title"
                        >
                          {column.label}
                        </button>
                      ) : (
                        <span className="support-board-column-title support-board-column-title-static">{column.label}</span>
                      )}
                      <p className="support-board-column-description">
                        {columnItems.length} {columnItems.length === 1 ? "ticket nesta etapa" : "tickets nesta etapa"}
                      </p>
                    </div>
                    <div className="support-board-column-head-side">
                      <span className="support-board-column-count">{columnItems.length}</span>
                    </div>
                  </div>
                  {isPrivileged ? (
                    <div className="support-board-column-tools">
                      <button
                        type="button"
                        className="support-board-column-tool"
                        onClick={() => startEditColumn(column.key, column.label)}
                        aria-label={`Editar coluna ${column.label}`}
                        title="Editar coluna"
                      >
                        <FiEdit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="support-board-column-tool support-board-column-tool-danger"
                        onClick={() => handleRemoveColumn(column.key)}
                        aria-label={`Remover coluna ${column.label}`}
                        title="Remover coluna"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="support-board-column-list">
                  {columnItems.map((suporte) => {
                    const creatorLabel = suporte.createdByName || suporte.createdByEmail || suporte.createdBy || "-";
                    const assigneeLabel = suporte.assignedToName || suporte.assignedToEmail || "Nao definido";
                    const canManageSuporte = isPrivileged;
                    const parsedDescription = parseSupportDescription(suporte.description);

                    return (
                      <article key={suporte.id} className="support-board-card" data-search-match={ticketSearch.trim() ? "true" : undefined}>
                        <button
                          type="button"
                          draggable={canManageSuporte}
                          onDragStart={canManageSuporte ? (event) => {
                            event.stopPropagation();
                            event.dataTransfer.setData("text/plain", suporte.id);
                            event.dataTransfer.effectAllowed = "move";
                            handleDragStart(suporte);
                          } : undefined}
                          onDragEnd={canManageSuporte ? (event) => {
                            event.stopPropagation();
                            setDragging(null);
                          } : undefined}
                          onClick={() => setSelectedSuporte(suporte)}
                          className="support-board-card-button"
                        >
                          <div className="support-board-card-top">
                            <p className="support-board-card-code">
                              {suporte.code || `SP-${suporte.id.slice(0, 6).toUpperCase()}`}
                            </p>
                            <span className="support-board-card-status" data-theme={columnTheme}>
                              {getSuporteStatusLabel(normalizeKanbanStatus(suporte.status), statusOptions)}
                            </span>
                          </div>

                          <p className="support-board-card-title">{suporte.title || "Sem titulo"}</p>
                          <p className="support-board-card-description">
                            {shortText(parsedDescription.text, 108)}
                          </p>
                          {parsedDescription.evidence.length > 0 ? (
                            <div className="support-board-card-evidence">
                              <FiPaperclip size={12} />
                              <span>
                                {parsedDescription.evidence.length === 1
                                  ? "1 evidencia"
                                  : `${parsedDescription.evidence.length} evidencias`}
                              </span>
                            </div>
                          ) : null}

                          <div className="support-board-badge-row">
                            <span
                              className="support-board-badge"
                              data-kind="type"
                              data-value={(suporte.type ?? "tarefa").toLowerCase()}
                            >
                              {getSupportTypeLabel(suporte.type)}
                            </span>
                            <span
                              className="support-board-badge"
                              data-kind="priority"
                              data-value={(suporte.priority ?? "medium").toLowerCase()}
                            >
                              {getSupportPriorityLabel(suporte.priority)}
                            </span>
                          </div>

                          <div className="support-board-kv-grid">
                            <div className="support-board-kv">
                              <span>Criador</span>
                              <strong title={creatorLabel}>{creatorLabel}</strong>
                            </div>
                            <div className="support-board-kv">
                              <span>Responsavel</span>
                              <strong title={assigneeLabel}>{assigneeLabel}</strong>
                            </div>
                          </div>

                          <div className="support-board-card-footer">
                            <span>Criado {formatDate(suporte.createdAt)}</span>
                            <span>Atualizado {formatDate(suporte.updatedAt)}</span>
                          </div>
                        </button>

                        <div className="support-board-card-controls">
                          <label className="support-board-card-control" htmlFor={`status-${suporte.id}`}>
                            <span className="support-board-card-control-label">Mover para</span>
                            {canManageSuporte ? (
                              <select
                                id={`status-${suporte.id}`}
                                aria-label="Status do suporte"
                                title="Status do suporte"
                                className="support-board-card-select"
                                value={normalizeKanbanStatus(suporte.status)}
                                onChange={(e) => updateStatus(suporte.id, e.target.value as SuporteStatus)}
                              >
                                {statusOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                id={`status-${suporte.id}`}
                                aria-label="Status do suporte"
                                title="Status do suporte"
                                className="support-board-card-select"
                                value={normalizeKanbanStatus(suporte.status)}
                                disabled
                                tabIndex={-1}
                              >
                                <option value={normalizeKanbanStatus(suporte.status)}>
                                  {getSuporteStatusLabel(normalizeKanbanStatus(suporte.status), statusOptions)}
                                </option>
                              </select>
                            )}
                          </label>

                          {!canManageSuporte ? (
                            <p className="support-board-card-warning">
                              Apenas o time de suporte pode alterar status e responsavel.
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}

                  {columnItems.length === 0 ? (
                    <div className="support-board-column-empty">
                      <p className="support-board-column-empty-title">Sem tickets nesta etapa</p>
                      <p className="support-board-column-empty-copy">
                        Novos tickets aparecerao aqui quando entrarem neste fluxo.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        </div>
      </section>

      <SuporteDetailsModal
        open={Boolean(selectedSuporte)}
        suporte={selectedSuporte}
        onClose={() => setSelectedSuporte(null)}
        canEditStatus={isPrivileged}
        statusOptions={statusOptions}
        onSuporteUpdated={(updated: SuporteItem) => {
          setSelectedSuporte(updated);
          setSuportes((current) =>
            current.map((suporte) => (suporte.id === updated.id ? updated : suporte)),
          );
        }}
      />

      {createOpen && (
        <div
          className="ticket-detail-modal-overlay support-create-modal-overlay"
          onClick={closeCreateModal}
        >
          <div
            className="support-create-modal-shell"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-create-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="support-create-modal-header">
              <div className="support-create-modal-heading">
                <span className="support-create-modal-icon">
                  <FiLifeBuoy size={18} />
                </span>
                <div className="support-create-modal-heading-copy">
                  <p className="support-create-modal-kicker">SUPORTE</p>
                  <h2 id="support-create-modal-title" className="support-create-modal-title">
                    Novo suporte
                  </h2>
                  <p className="support-create-modal-subtitle">
                    Abra um ticket com titulo, descricao, tipo e prioridade.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="support-create-modal-close"
                aria-label="Fechar modal de novo suporte"
                title="Fechar"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="support-create-modal-body">
              <div className="support-create-modal-form">
                <label className="support-create-modal-field" htmlFor="kanban-create-suporte-title">
                  <span className="support-create-modal-label">Titulo</span>
                  <input
                    id="kanban-create-suporte-title"
                    className="support-create-modal-input"
                    placeholder="Digite o titulo do suporte"
                    value={createDraft.title}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </label>

                <label className="support-create-modal-field" htmlFor="kanban-create-suporte-description">
                  <span className="support-create-modal-label">Descricao</span>
                  <textarea
                    id="kanban-create-suporte-description"
                    rows={5}
                    className="support-create-modal-textarea"
                    placeholder="Descreva o suporte..."
                    value={createDraft.description}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </label>

                <div className="support-create-modal-select-grid">
                  <label className="support-create-modal-field" htmlFor="kanban-create-suporte-type">
                    <span className="support-create-modal-label">Tipo</span>
                    <select
                      id="kanban-create-suporte-type"
                      aria-label="Tipo do suporte"
                      title="Tipo do suporte"
                      className="support-create-modal-select"
                      value={createDraft.type}
                      onChange={(e) => setCreateDraft((prev) => ({ ...prev, type: e.target.value }))}
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="support-create-modal-field" htmlFor="kanban-create-suporte-priority">
                    <span className="support-create-modal-label">Prioridade</span>
                    <select
                      id="kanban-create-suporte-priority"
                      aria-label="Prioridade do suporte"
                      title="Prioridade do suporte"
                      className="support-create-modal-select"
                      value={createDraft.priority}
                      onChange={(e) => setCreateDraft((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {createError && <p className="support-create-modal-error">{createError}</p>}
              </div>
            </div>

            <div className="support-create-modal-footer">
              <input
                ref={createEvidenceInputRef}
                type="file"
                className="sr-only"
                accept="image/*,.pdf,.txt,.log,.json,.zip,.csv,.xlsx,.doc,.docx"
                onChange={(event) => setCreateEvidenceFile(event.target.files?.[0] ?? null)}
              />
              <div className="support-create-modal-footer-side">
                <button
                  type="button"
                  onClick={() => createEvidenceInputRef.current?.click()}
                  className="support-create-modal-attach"
                  aria-label={createEvidenceFile ? "Trocar evidencia" : "Anexar evidencia"}
                  title={createEvidenceFile ? "Trocar evidencia" : "Anexar evidencia"}
                >
                  <FiPaperclip size={16} />
                </button>
                {createEvidenceFile ? (
                  <div className="support-create-modal-file-chip">
                    <span className="support-create-modal-file-name" title={createEvidenceFile.name}>
                      {createEvidenceFile.name}
                    </span>
                    <button
                      type="button"
                      className="support-create-modal-file-remove"
                      onClick={() => {
                        setCreateEvidenceFile(null);
                        if (createEvidenceInputRef.current) createEvidenceInputRef.current.value = "";
                      }}
                      aria-label="Remover evidencia"
                      title="Remover evidencia"
                    >
                      <FiX size={12} />
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="support-create-modal-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitCreate}
                disabled={creating}
                className="support-create-modal-primary"
              >
                <FiPlus size={14} />
                {creating ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
