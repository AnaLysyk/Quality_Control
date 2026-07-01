"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "../AccessRequests.module.css";

import {
  FiChevronLeft,
  FiChevronRight,
  FiCircle,
  FiClock,
  FiDownload,
  FiEdit3,
  FiEye,
  FiFileText,
  FiMoreVertical,
  FiSearch,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";

type AccessRequestTableItem = {
  id: string;
  createdAt: string;
  status: string;
  email: string;
  name: string;
  fullName: string;
  username: string | null;
  phone: string;
  jobRole: string;
  accessType: string;
  clientId: string | null;
  company: string;
  title: string;
  description: string;
  notes: string;
  passwordProvided: boolean;
  adjustmentRound?: number;
  lastAdjustmentAt?: string | null;
  lastAdjustmentDiff?: unknown[];
  visualProfile?: {
    avatarKind?: "emoji" | "gif" | "default" | "image";
    avatarValue?: string;
    avatarLabel?: string;
  } | null;
};

type QueueHistoryItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  sortDate: string;
  tone: "ok" | "warn" | "danger" | "neutral";
};

type AccessRequestsTableExperienceProps = {
  items: AccessRequestTableItem[];
  loading: boolean;
  total: number;
  statusCounts?: {
    approved: number;
    inProgress: number;
    open: number;
    rejected: number;
    total: number;
  };
  selectedId: string | null;
  onSelect: (id: string) => void;

  searchTerm: string;
  onSearchChange: (value: string) => void;

  statusFilter: string;
  onStatusFilterChange: (value: string) => void;

  dateFilter: string;
  onDateFilterChange: (value: string) => void;

  onDelete: (id: string) => Promise<void>;
  detail: (mode: "view" | "edit") => ReactNode;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleString("pt-BR");
}

function displayName(item: AccessRequestTableItem) {
  return item.fullName || item.name || item.email || "(sem nome)";
}

function isImageAvatar(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/");
}

function RequestAvatar({ item, size = "md" }: { item: AccessRequestTableItem; size?: "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const visual = item.visualProfile;
  const value = visual?.avatarValue?.trim() ?? "";
  const isLarge = size === "lg";
  const boxClass = isLarge ? "h-12 w-12 rounded-full" : "h-9 w-9 rounded-full";

  if ((visual?.avatarKind === "image" || visual?.avatarKind === "gif") && isImageAvatar(value) && !broken) {
    return (
      <div
        className={`relative isolate flex shrink-0 items-center justify-center overflow-hidden border border-(--tc-border) bg-white shadow-[0_8px_18px_rgba(1,24,72,0.10)] [contain:paint] ${boxClass}`}
        style={{ lineHeight: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt={visual.avatarLabel || "Foto do solicitante"}
          className="block h-full w-full rounded-full object-cover object-center"
          onError={() => setBroken(true)}
          draggable={false}
        />
      </div>
    );
  }

  if (visual?.avatarKind === "emoji" && value) {
    return (
      <div
        className={`relative isolate flex shrink-0 items-center justify-center overflow-hidden border border-(--tc-border) bg-white text-base shadow-[0_8px_18px_rgba(1,24,72,0.10)] [contain:paint] ${boxClass}`}
        style={{ lineHeight: 1 }}
      >
        <span className="block text-lg leading-none">{value}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative isolate flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef4ff_100%)] text-(--tc-primary) shadow-[0_8px_18px_rgba(1,24,72,0.10)] [contain:paint] ${boxClass}`}
      title="Perfil sem foto"
      aria-label="Perfil sem foto"
    >
      <FiUser className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "closed") return "Aprovada";
  if (status === "rejected") return "Rejeitada";
  if (status === "in_progress") return "Aguardando ajuste";
  return "Aberta";
}

function statusClass(status: string) {
  if (status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function statusDotClass(status: string) {
  if (status === "closed") return "bg-emerald-500";
  if (status === "rejected") return "bg-rose-500";
  if (status === "in_progress") return "bg-amber-500";
  return "bg-sky-500";
}

async function downloadRequestPdf(item: AccessRequestTableItem) {
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 16;
  let y = 18;

  function drawHeader(title = "Relatório de solicitação") {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, 34, "F");
    pdf.setFillColor(1, 24, 72);
    pdf.rect(0, 0, pageWidth, 7, "F");
    pdf.setFillColor(239, 0, 1);
    pdf.rect(0, 7, 54, 1.6, "F");

    pdf.setTextColor(1, 24, 72);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text(title, margin, 18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text("Quality Control · Central de aprovação", margin, 25);
    pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth - margin, 25, { align: "right" });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, 31, pageWidth - margin, 31);
    pdf.setTextColor(15, 23, 42);
    y = 44;
  }

  function drawSectionTitle(title: string) {
    if (y > 260) {
      pdf.addPage();
      drawHeader(title);
      return;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(1, 24, 72);
    pdf.text(title.toUpperCase(), margin, y);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + 3, pageWidth - margin, y + 3);
    y += 9;
  }

  function drawRow(label: string, value: string) {
    if (y > 276) {
      pdf.addPage();
      drawHeader();
    }
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y - 5, pageWidth - margin * 2, 10, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label.toUpperCase(), margin + 4, y + 1);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    const wrapped = pdf.splitTextToSize(value || "Não informado", 112);
    pdf.text(wrapped, margin + 48, y + 1);
    y += Math.max(11, wrapped.length * 5);
  }

  drawHeader("Solicitação de acesso");

  const nameLines = pdf.splitTextToSize(displayName(item), pageWidth - margin * 2 - 10);
  const heroHeight = Math.max(24, 14 + nameLines.length * 6);
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, y - 4, pageWidth - margin * 2, heroHeight, 4, 4, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42);
  pdf.text(nameLines, margin + 5, y + 5);
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`${item.accessType || "Perfil não informado"} · ${statusLabel(item.status)}`, margin + 5, y + 7 + nameLines.length * 6);
  y += heroHeight + 8;

  const rows = [
    ["Nome", displayName(item)],
    ["E-mail", item.email || "Não informado"],
    ["Usuário", item.username || "A definir"],
    ["Telefone", item.phone || "Não informado"],
    ["Empresa", item.company || "Não informada"],
    ["Cargo", item.jobRole || "Não informado"],
    ["Perfil", item.accessType || "Não informado"],
    ["Status", statusLabel(item.status)],
    ["Senha", item.passwordProvided ? "Informada" : "Pendente"],
    ["Recebida em", formatDate(item.createdAt)],
    ["Título", item.title || "Não informado"],
    ["Descrição", item.description || "Não informada"],
    ["Observações", item.notes || "Não informado"],
  ];

  drawSectionTitle("Dados do perfil");
  rows.slice(0, 10).forEach(([label, value]) => drawRow(label, String(value)));
  drawSectionTitle("Contexto da solicitação");
  rows.slice(10).forEach(([label, value]) => drawRow(label, String(value)));

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text("Documento gerado automaticamente pela plataforma Quality Control.", margin, 288);

  pdf.save(`solicitacao-${item.id}.pdf`);
}

export function AccessRequestsTableExperience({
  items,
  loading,
  total,
  statusCounts,
  selectedId,
  onSelect,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
  onDelete,
  detail,
}: AccessRequestsTableExperienceProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 12 });
  const [open, setOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [removeCandidate, setRemoveCandidate] = useState<AccessRequestTableItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [queueHistoryOpen, setQueueHistoryOpen] = useState(false);
  const [expandedQueueHistoryId, setExpandedQueueHistoryId] = useState<string | null>(null);
  const [queueDeletedHistory, setQueueDeletedHistory] = useState<QueueHistoryItem[]>([]);
  const selectedItem = useMemo(
    () => (selectedId ? items.find((item) => item.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function handleAssistantAction(event: Event) {
      const detail = (event as CustomEvent<{
        action?: "view" | "pdf" | "remove" | "approve" | "reject" | "request_adjustment";
        requestId?: string;
        mode?: "view" | "edit";
      }>).detail ?? {};
      const item = items.find((candidate) => candidate.id === detail.requestId);
      if (!item) return;

      onSelect(item.id);
      setOpenActionMenuId(null);

      if (detail.action === "pdf") {
        setModalMode("view");
        setOpen(true);
        void downloadRequestPdf(item);
        return;
      }

      if (detail.action === "remove") {
        setRemoveCandidate(item);
        return;
      }

      setModalMode(detail.mode ?? (detail.action === "view" ? "view" : "edit"));
      setOpen(true);
    }

    window.addEventListener("access-requests:assistant-action", handleAssistantAction);
    return () => window.removeEventListener("access-requests:assistant-action", handleAssistantAction);
  }, [items, onSelect]);

  const queueHistoryItems = useMemo<QueueHistoryItem[]>(() => {
    const events: QueueHistoryItem[] = [];

    items.forEach((item) => {
      const name = displayName(item);
      const date = item.lastAdjustmentAt || item.createdAt;

      if (item.status === "closed") {
        events.push({
          id: "approved-" + item.id,
          title: "Solicitação aceita",
          description: name + " foi aprovado(a).",
          date: formatDate(date),
          sortDate: date,
          tone: "ok",
        });
        return;
      }

      if (item.status === "rejected") {
        events.push({
          id: "rejected-" + item.id,
          title: "Solicitação recusada",
          description: name + " foi recusado(a).",
          date: formatDate(date),
          sortDate: date,
          tone: "danger",
        });
        return;
      }

      if (item.status === "in_progress") {
        events.push({
          id: "adjustment-" + item.id,
          title: "Ajuste solicitado",
          description: name + " está aguardando correção do solicitante.",
          date: formatDate(date),
          sortDate: date,
          tone: "warn",
        });
      }
    });

    events.push(...queueDeletedHistory);

    return events.sort((left, right) =>
      String(right.sortDate).localeCompare(String(left.sortDate)),
    );
  }, [items, queueDeletedHistory]);

  const columns = useMemo<ColumnDef<AccessRequestTableItem>[]>(
    () => [
      {
        id: "person",
        header: "Solicitante",
        accessorFn: (row) => displayName(row),
        cell: ({ row }) => {
          const item = row.original;
          const name = displayName(item);

          return (
            <div className="relative z-0 flex min-w-75 items-center gap-3 overflow-hidden py-1">
              <RequestAvatar item={item} />

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-(--tc-text-primary)">{name}</p>
                <p className="truncate text-xs font-semibold text-(--tc-accent)">{item.email}</p>
                <p className="mt-1 truncate text-xs text-(--tc-text-muted)">{item.jobRole || "Cargo não informado"}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: "company",
        header: "Empresa",
        accessorFn: (row) => row.company || "",
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-(--tc-text-secondary)">
            {row.original.company || "Não informada"}
          </span>
        ),
      },
      {
        id: "accessType",
        header: "Perfil",
        accessorFn: (row) => row.accessType || "",
        cell: ({ row }) => (
          <span className="inline-flex max-w-46 items-center whitespace-nowrap rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-black leading-none text-violet-700">
            {row.original.accessType || "Não informado"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status,
        cell: ({ row }) => (
          <span className={`inline-flex min-w-max items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black leading-none ${statusClass(row.original.status)}`}>
            {statusLabel(row.original.status)}
          </span>
        ),
      },
      {
        id: "passwordProvided",
        header: "Senha",
        accessorFn: (row) => (row.passwordProvided ? "sim" : "não"),
        cell: ({ row }) => (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-black ${
              row.original.passwordProvided
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {row.original.passwordProvided ? "Informada" : "Pendente"}
          </span>
        ),
      },
      {
        id: "changes",
        header: "Alterações",
        accessorFn: (row) => row.lastAdjustmentDiff?.length ?? 0,
        cell: ({ row }) => {
          const count = row.original.lastAdjustmentDiff?.length ?? 0;
          return (
            <span className="inline-flex min-w-6 justify-center text-sm font-black text-(--tc-text-primary)">
              {count}
            </span>
          );
        },
      },
      {
        id: "createdAt",
        header: "Recebida em",
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs font-semibold text-(--tc-text-muted)">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Ações",
        enableSorting: false,
        size: 76,
        cell: ({ row }) => {
          const item = row.original;
          const isFinal = item.status === "closed" || item.status === "rejected";
          const menuOpen = openActionMenuId === item.id;

          const closeMenu = () => setOpenActionMenuId(null);

          return (
            <div className="relative flex justify-end">
              <button
                type="button"
                aria-label="Abrir ações da solicitação"
                title="Ações"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenActionMenuId(menuOpen ? null : item.id);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--tc-border) bg-(--tc-surface) text-(--tc-text-secondary) shadow-[0_10px_22px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:bg-(--tc-surface-2)"
              >
                <FiMoreVertical />
              </button>

              {menuOpen ? (
                <div
                  className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-2xl border border-(--tc-border) bg-(--tc-surface) text-left shadow-[0_22px_60px_rgba(15,23,42,0.18)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    data-brain-action="view"
                    onClick={() => {
                      onSelect(item.id);
                      setModalMode("view");
                      setOpen(true);
                      closeMenu();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-(--tc-text-primary) transition hover:bg-(--tc-surface-2)"
                  >
                    <FiEye />
                    Visualizar
                  </button>

                  {!isFinal ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item.id);
                        setModalMode("edit");
                        setOpen(true);
                        closeMenu();
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-(--tc-text-primary) transition hover:bg-(--tc-surface-2)"
                    >
                      <FiEdit3 />
                      Analisar / editar
                    </button>
                  ) : null}

                  <button
                    type="button"
                    aria-label="Baixar solicitação em PDF"
                    title="Baixar solicitação em PDF"
                    data-brain-action="pdf"
                    onClick={() => {
                      void downloadRequestPdf(item);
                      closeMenu();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-(--tc-text-primary) transition hover:bg-(--tc-surface-2)"
                  >
                    <FiDownload />
                    Baixar PDF
                  </button>

                  {!isFinal ? (
                    <button
                      type="button"
                      data-brain-action="remove"
                      onClick={() => {
                        setRemoveCandidate(item);
                        closeMenu();
                      }}
                      className="flex w-full items-center gap-3 border-t border-(--tc-border) px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                    >
                      <FiTrash2 />
                      Remover da fila
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        },
      },
    ],
    [onSelect, openActionMenuId],
  );

  // TanStack Table intentionally returns non-memoizable helpers.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, dateFilter]);

  const sortedColumnId = sorting[0]?.id ?? null;
  const statusQuickFilters = useMemo(
    () => [
      { value: "all", label: "Todas", count: statusCounts?.total ?? items.length },
      { value: "open", label: "Novas", count: statusCounts?.open ?? items.filter((item) => item.status === "open").length },
      { value: "in_progress", label: "Em ajuste", count: statusCounts?.inProgress ?? items.filter((item) => item.status === "in_progress").length },
      { value: "closed", label: "Aprovadas", count: statusCounts?.approved ?? items.filter((item) => item.status === "closed").length },
      { value: "rejected", label: "Recusadas", count: statusCounts?.rejected ?? items.filter((item) => item.status === "rejected").length },
    ],
    [items, statusCounts],
  );

  return (
    <>
      {queueHistoryOpen ? (
        <section className={`${styles.queueShell} mb-4 overflow-hidden rounded-[26px] border border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary) shadow-[0_22px_70px_rgba(15,23,42,0.12)]`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--tc-border) bg-(--tc-surface-2) px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-[0_14px_32px_rgba(15,23,42,0.18)]">
                <FiClock className="h-4 w-4" />
              </span>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Histórico da fila</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Movimentações de solicitações</h3>
                <p className="mt-0.5 text-sm font-semibold text-slate-500">
                  Aceites, recusas, ajustes solicitados e remoções.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setQueueHistoryOpen(false)}
              aria-label="Fechar histórico"
              title="Fechar"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-(--tc-surface) text-(--tc-text-secondary) transition hover:bg-slate-50"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-86 overflow-y-auto bg-(--tc-surface) px-5 py-4">
            {queueHistoryItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-5 text-center">
                <p className="text-sm font-black text-slate-800">Nenhuma movimentação registrada</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  As ações feitas na fila aparecem aqui.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-3 before:absolute before:left-4 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-slate-200">
                {queueHistoryItems.map((event) => {
                  const expanded = expandedQueueHistoryId === event.id;

                  const toneClasses =
                    event.tone === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : event.tone === "danger"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : event.tone === "warn"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-slate-200 bg-slate-100 text-slate-700";

                  const dotClasses =
                    event.tone === "ok"
                      ? "bg-emerald-500"
                      : event.tone === "danger"
                        ? "bg-rose-500"
                        : event.tone === "warn"
                          ? "bg-amber-500"
                          : "bg-slate-400";

                  return (
                    <li key={event.id} className="relative pl-10">
                      <span className={"absolute left-2.5 top-4 h-3 w-3 rounded-full border-2 border-white shadow-sm " + dotClasses} />

                      <button
                        type="button"
                        onClick={() => setExpandedQueueHistoryId(expanded ? null : event.id)}
                        className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-slate-950">{event.title}</p>
                            <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-500">
                              {event.description}
                            </p>
                          </div>

                          <span className={"shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] " + toneClasses}>
                            {event.date}
                          </span>
                        </div>

                        {expanded ? (
                          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-semibold leading-6 text-slate-700">
                              {event.description}
                            </p>
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      ) : null}

      <section className={`${styles.queueShell} overflow-hidden rounded-[24px] border border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary) shadow-[0_18px_54px_rgba(15,23,42,0.09)]`}>
        <div className="border-b border-(--tc-border) bg-[linear-gradient(135deg,var(--tc-surface)_0%,var(--tc-surface-2)_55%,rgba(239,0,1,0.06)_130%)] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-(--tc-text-muted)">Fila de análise</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-(--tc-text-secondary)">
                Use a busca e os filtros para encontrar perfis, revisar alterações e concluir decisões.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {selectedItem ? (
                <div className="hidden h-10 max-w-74 items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3.5 text-sky-900 shadow-[0_10px_24px_rgba(14,165,233,0.10)] dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-100 sm:inline-flex">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                  <span className="truncate text-xs font-black uppercase tracking-[0.12em]">
                    Selecionada: {displayName(selectedItem)}
                  </span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setQueueHistoryOpen((current) => !current)}
                aria-label="Abrir histórico da fila"
                title="Histórico da fila"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--tc-border) bg-white text-(--tc-text-secondary) shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-[rgba(239,0,1,0.28)] hover:bg-(--tc-surface-2)"
              >
                <FiClock className="h-4 w-4" />
              </button>

              <div className="inline-flex h-10 items-center gap-2 rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-3.5 text-(--tc-text-primary) shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-(--tc-text-muted)">
                  Total
                </span>
                <span className="text-base font-black leading-none text-(--tc-primary)">
                  {total}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(260px,1fr)_180px_180px]">
            <label className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--tc-text-muted)" />
              <input
                value={searchTerm}
                onChange={(event) => {
                  onSearchChange(event.target.value);
                  table.setPageIndex(0);
                }}
                placeholder="Buscar por nome, e-mail, empresa, perfil ou cargo"
                className="h-12 w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface) pl-11 pr-4 text-sm font-semibold text-(--tc-text-primary) outline-none transition placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.10)]"
              />
            </label>

            <select
              aria-label="Filtrar solicitações por status"
              title="Filtrar solicitações por status"
              value={statusFilter}
              onChange={(event) => {
                onStatusFilterChange(event.target.value);
                table.setPageIndex(0);
              }}
              className="h-12 rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 text-sm font-black text-(--tc-text-primary) outline-none transition focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.10)]"
            >
              <option value="all">Todos os status</option>
              <option value="open">Aberta</option>
              <option value="in_progress">Aguardando ajuste</option>
              <option value="closed">Aprovada</option>
              <option value="rejected">Rejeitada</option>
            </select>

            <select
              aria-label="Filtrar solicitações por período"
              title="Filtrar solicitações por período"
              value={dateFilter}
              onChange={(event) => {
                onDateFilterChange(event.target.value);
                table.setPageIndex(0);
              }}
              className="h-12 rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 text-sm font-black text-(--tc-text-primary) outline-none transition focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.10)]"
            >
              <option value="all">Todo o histórico</option>
              <option value="two_hours">Data: últimas 2 horas</option>
              <option value="today">Data: hoje</option>
              <option value="week">Últimos 7 dias</option>
              <option value="month">Últimos 30 dias</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {statusQuickFilters.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onStatusFilterChange(option.value);
                  table.setPageIndex(0);
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                  statusFilter === option.value
                    ? "border-[#011848] bg-[#011848] text-white shadow-[0_12px_24px_rgba(1,24,72,0.18)] dark:border-sky-500/40 dark:bg-sky-950 dark:text-sky-100"
                    : "border-(--tc-border) bg-(--tc-surface) text-(--tc-text-secondary) hover:border-[rgba(239,0,1,0.25)] hover:text-(--tc-text-primary)"
                }`}
              >
                <FiCircle className={`h-2 w-2 ${statusFilter === option.value ? "text-white" : statusDotClass(option.value)}`} />
                {option.label}
                <span className="opacity-75">{option.count}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-sm font-semibold text-(--tc-text-muted)">Carregando solicitações...</div>
        ) : items.length === 0 ? (
          <div className="flex min-h-90 items-center justify-center p-8 text-center">
            <div className="max-w-md">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-(--tc-surface-2) text-2xl">🔎</div>
              <h3 className="mt-5 text-xl font-black text-(--tc-text-primary)">Nenhuma solicitação encontrada</h3>
              <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary)">
                Ajuste os filtros ou busque por outro nome, e-mail, empresa, perfil ou cargo.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-306px)] overflow-auto">
              <table className="w-full min-w-250 border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-(--tc-surface) shadow-[0_1px_0_var(--tc-border)]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        const sorted = header.column.getIsSorted();
                        const active = sortedColumnId === header.column.id;

                        return (
                          <th
                            key={header.id}
                            className={`whitespace-nowrap border-b border-(--tc-border) px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] ${
                              active
                                ? "bg-sky-50 text-sky-800 dark:bg-sky-950/55 dark:text-sky-200"
                                : "text-(--tc-text-muted)"
                            }`}
                          >
                            <button
                              type="button"
                              disabled={!canSort}
                              onClick={header.column.getToggleSortingHandler()}
                              className={`inline-flex items-center gap-2 ${canSort ? "cursor-pointer hover:text-(--tc-text-primary)" : "cursor-default"}`}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className={active ? "text-sky-700 dark:text-sky-300" : "text-(--tc-text-muted)"}>
                                {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : canSort ? "↕" : ""}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>

                <tbody>
                  {table.getRowModel().rows.map((row) => {
                    const active = row.original.id === selectedId;

                    return (
                      <tr
                        key={row.id}
                        data-brain-row="access-request"
                        data-brain-id={row.original.id}
                        data-brain-name={displayName(row.original)}
                        data-brain-email={row.original.email}
                        data-brain-status={statusLabel(row.original.status)}
                        data-brain-status-value={row.original.status}
                        data-brain-profile={row.original.accessType || "Não informado"}
                        data-brain-company={row.original.company || "Não informada"}
                        data-brain-changes={row.original.lastAdjustmentDiff?.length ?? 0}
                        onClick={() => {
                          onSelect(row.original.id);
                          setModalMode("view");
                          setOpen(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelect(row.original.id);
                            setModalMode("view");
                            setOpen(true);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={`group cursor-pointer transition ${
                          active
                            ? "bg-sky-50/80 dark:bg-sky-950/40"
                            : "odd:bg-(--tc-surface) even:bg-(--tc-surface-2) hover:bg-sky-50/50 dark:hover:bg-sky-950/25"
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="border-b border-(--tc-border) px-4 py-3 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--tc-border) bg-(--tc-surface) px-5 py-4">
              <p className="text-sm font-semibold text-(--tc-text-secondary)">
                Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()} · {items.length} resultado(s)
              </p>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Quantidade de solicitações por página"
                  title="Quantidade de solicitações por página"
                  value={table.getState().pagination.pageSize}
                  onChange={(event) => table.setPageSize(Number(event.target.value))}
                  className="h-10 rounded-xl border border-(--tc-border) bg-(--tc-surface) px-3 text-sm font-bold text-(--tc-text-primary)"
                >
                  {[10, 12, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}/página
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary) transition hover:bg-(--tc-surface-2) disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <FiChevronLeft />
                </button>

                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary) transition hover:bg-(--tc-surface-2) disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="mt-4 space-y-3 lg:hidden">
        {table.getRowModel().rows.map((row) => {
          const item = row.original;
          const active = item.id === selectedId;

          return (
            <button
              type="button"
              key={`mobile-${item.id}`}
              onClick={() => {
                onSelect(item.id);
                setModalMode("view");
                setOpen(true);
              }}
              className={`w-full rounded-[26px] border p-4 text-left transition ${
                active
                  ? "border-sky-200 bg-sky-50 shadow-[0_18px_40px_rgba(14,165,233,0.12)] dark:border-sky-700/60 dark:bg-sky-950/40"
                  : "border-(--tc-border) bg-(--tc-surface) hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <RequestAvatar item={item} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-(--tc-text-primary)">{displayName(item)}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-(--tc-text-secondary)">{item.email}</p>
                  <p className="mt-1 text-xs text-(--tc-text-muted)">
                    {item.company || "Empresa não informada"} · {item.accessType || "Perfil não informado"}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-sm" />
          <Dialog.Content
            data-access-requests-dialog="profile"
            className={`${styles.queueShell} fixed left-1/2 top-1/2 z-[101] flex max-h-[calc(100dvh-12px)] w-[min(1720px,calc(100vw-12px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[30px] border border-(--tc-border) bg-(--tc-surface) shadow-[0_34px_100px_rgba(15,23,42,0.35)] sm:max-h-[calc(100dvh-8px)] sm:w-[min(1720px,calc(100vw-24px))]`}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[linear-gradient(135deg,var(--tc-primary)_0%,#071a44_48%,rgba(239,0,1,0.74)_150%)] px-6 py-4 text-white">
              <div>
                <Dialog.Title className="text-xl font-black tracking-tight !text-white">
                  {modalMode === "view" ? "Visualização da solicitação" : "Análise da solicitação"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-white/75">
                  {modalMode === "view"
                    ? "Consulta em modo somente leitura. Para alterar, use o lápis na listagem."
                    : "Revise dados, histórico, conversa, ajustes e decisão."}
                </Dialog.Description>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-brain-action="pdf"
                  aria-label="Download PDF"
                  title="Download PDF"
                  onClick={() => selectedItem && void downloadRequestPdf(selectedItem)}
                  disabled={!selectedItem}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-sm font-black text-white transition hover:bg-white/20"
                >
                  <FiFileText />
                </button>

                <Dialog.Close className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-sm font-black text-white transition hover:bg-white/20">
                  <FiX />
                </Dialog.Close>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-(--tc-surface)">
              {detail(modalMode)}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={Boolean(removeCandidate)} onOpenChange={(value) => !value && setRemoveCandidate(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[105] bg-slate-950/45 backdrop-blur-sm" />
          <Dialog.Content
            data-access-requests-dialog="remove"
            className="fixed left-1/2 top-1/2 z-[106] w-[min(1720px,calc(100vw-12px))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-rose-100 bg-(--tc-surface) p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
          >
            <Dialog.Title className="text-xl font-black text-(--tc-text-primary)">Remover solicitação?</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-6 text-(--tc-text-secondary)">
              Essa solicitação será removida da listagem principal e a movimentação deverá ficar registrada nos logs.
            </Dialog.Description>

            {removeCandidate ? (
              <div className="mt-5 rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
                <p className="font-black text-(--tc-text-primary)">{displayName(removeCandidate)}</p>
                <p className="mt-1 text-sm font-semibold text-(--tc-accent)">{removeCandidate.email}</p>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm font-black text-(--tc-text-secondary) transition hover:bg-(--tc-surface-2)">
                Cancelar
              </Dialog.Close>

              <button
                type="button"
                onClick={async () => {
                  if (!removeCandidate) return;
                  setRemoving(true);
                  try {
                    const removed = removeCandidate;
                    await onDelete(removed.id);
                    setQueueDeletedHistory((current) => [
                      {
                        id: "deleted-" + removed.id + "-" + Date.now(),
                        title: "Solicitação removida",
                        description: displayName(removed) + " foi removido(a) da fila.",
                        date: formatDate(new Date().toISOString()),
                        sortDate: new Date().toISOString(),
                        tone: "neutral",
                      },
                      ...current,
                    ]);
                    setRemoveCandidate(null);
                  } catch {
                    // The page-level handler surfaces the error in the visible toast.
                  } finally {
                    setRemoving(false);
                  }
                }}
                disabled={removing}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removing ? "Removendo..." : "Confirmar remoção"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
