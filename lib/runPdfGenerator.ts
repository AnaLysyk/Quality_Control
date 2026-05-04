import "server-only";

import { getRunDetailViewModel, type RunDetailViewModel } from "@/lib/runDetailViewModel";
import { getQaseRunKanban } from "@/integrations/qase";
import type { KanbanData, KanbanItem } from "@/types/kanban";

// Colors
const C = {
  navy: "#0b1a3c",
  white: "#ffffff",
  gray: "#6b7280",
  lightGray: "#e5e7eb",
  pass: "#22c55e",
  fail: "#ef4444",
  blocked: "#facc15",
  notRun: "#64748b",
  accent: "#2563eb",
  headerBg: "#031843",
} as const;

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

type PDF = InstanceType<typeof import("jspdf").jsPDF>;

function drawColoredCircle(pdf: PDF, x: number, y: number, r: number, color: string) {
  pdf.setFillColor(color);
  pdf.circle(x, y, r, "F");
}

function drawRoundedRect(
  pdf: PDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillColor: string,
) {
  pdf.setFillColor(fillColor);
  pdf.roundedRect(x, y, w, h, r, r, "F");
}

function drawHorizontalLine(pdf: PDF, y: number) {
  pdf.setDrawColor(C.lightGray);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
}

function ensureSpace(pdf: PDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    pdf.addPage();
    return MARGIN;
  }
  return y;
}

// ── Page 1: Header + Stats + Gate/Score ──────────────────────

function drawHeader(pdf: PDF, vm: RunDetailViewModel): number {
  // Dark header band
  drawRoundedRect(pdf, MARGIN, MARGIN, CONTENT_W, 36, 3, C.headerBg);

  pdf.setTextColor(C.white);
  pdf.setFontSize(8);
  pdf.text("RUN", MARGIN + 6, MARGIN + 10);

  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  const titleLines = pdf.splitTextToSize(vm.displayTitle, CONTENT_W - 60);
  pdf.text(titleLines, MARGIN + 6, MARGIN + 19);

  if (vm.displaySummary) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor("#d1d5db");
    pdf.text(vm.displaySummary.slice(0, 100), MARGIN + 6, MARGIN + 28);
  }

  // Right side — date
  pdf.setFontSize(8);
  pdf.setTextColor("#9ca3af");
  pdf.text(new Date().toLocaleDateString("pt-BR"), PAGE_W - MARGIN - 6, MARGIN + 10, {
    align: "right",
  });

  return MARGIN + 42;
}

function drawMetadata(pdf: PDF, vm: RunDetailViewModel, y: number): number {
  pdf.setTextColor(C.gray);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");

  const rows = [
    ["Aplicação", vm.appMeta.label],
    ["Run ID", vm.runId != null ? String(vm.runId) : "-"],
    ["Projeto", vm.projectCode],
    ["Origem", vm.source === "API" ? "Integração Qase" : "Manual"],
    ["Empresa", vm.companySlug !== "demo" ? vm.companySlug : "-"],
  ];

  for (const [label, value] of rows) {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(C.gray);
    pdf.text(`${label}:`, MARGIN, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(C.navy);
    pdf.text(value, MARGIN + 30, y);
    y += 5;
  }

  return y + 2;
}

function drawStatsBlock(pdf: PDF, vm: RunDetailViewModel, y: number): number {
  y = ensureSpace(pdf, y, 50);

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(C.navy);
  pdf.text("Resultados da Execução", MARGIN, y);
  y += 8;

  // Status bar
  const barH = 10;
  const barY = y;

  if (vm.total > 0) {
    const passW = (vm.stats.pass / vm.total) * CONTENT_W;
    const failW = (vm.stats.fail / vm.total) * CONTENT_W;
    const blockedW = (vm.stats.blocked / vm.total) * CONTENT_W;
    const notRunW = CONTENT_W - passW - failW - blockedW;

    let xOff = MARGIN;
    if (passW > 0) {
      pdf.setFillColor(C.pass);
      pdf.rect(xOff, barY, passW, barH, "F");
      xOff += passW;
    }
    if (failW > 0) {
      pdf.setFillColor(C.fail);
      pdf.rect(xOff, barY, failW, barH, "F");
      xOff += failW;
    }
    if (blockedW > 0) {
      pdf.setFillColor(C.blocked);
      pdf.rect(xOff, barY, blockedW, barH, "F");
      xOff += blockedW;
    }
    if (notRunW > 0) {
      pdf.setFillColor(C.notRun);
      pdf.rect(xOff, barY, notRunW, barH, "F");
    }
  } else {
    pdf.setFillColor(C.lightGray);
    pdf.rect(MARGIN, barY, CONTENT_W, barH, "F");
  }

  y = barY + barH + 6;

  // Stats legend row
  const statItems = [
    { label: "Pass", value: vm.stats.pass, color: C.pass },
    { label: "Fail", value: vm.stats.fail, color: C.fail },
    { label: "Blocked", value: vm.stats.blocked, color: C.blocked },
    { label: "Not Run", value: vm.stats.notRun, color: C.notRun },
    { label: "Total", value: vm.total, color: C.navy },
  ];

  const colW = CONTENT_W / statItems.length;
  statItems.forEach((item, idx) => {
    const x = MARGIN + idx * colW;
    drawColoredCircle(pdf, x + 2, y + 1.5, 1.5, item.color);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(C.gray);
    pdf.text(item.label, x + 6, y + 2.5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(C.navy);
    const pct = vm.total > 0 ? Math.round((item.value / vm.total) * 100) : 0;
    const valText = item.label === "Total" ? String(item.value) : `${item.value} (${pct}%)`;
    pdf.text(valText, x + 6, y + 7);
  });

  return y + 14;
}

function drawGateScore(pdf: PDF, vm: RunDetailViewModel, y: number): number {
  y = ensureSpace(pdf, y, 30);

  drawHorizontalLine(pdf, y);
  y += 6;

  // Gate box
  const gateColor =
    vm.gate.status === "approved" ? C.pass : vm.gate.status === "warning" ? C.blocked : C.fail;
  drawRoundedRect(pdf, MARGIN, y, CONTENT_W / 2 - 3, 18, 2, "#f8fafc");
  pdf.setDrawColor(gateColor);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(MARGIN, y, CONTENT_W / 2 - 3, 18, 2, 2, "S");

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(C.gray);
  pdf.text("Quality Gate", MARGIN + 4, y + 6);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(gateColor);
  pdf.text(vm.gate.status.toUpperCase(), MARGIN + 4, y + 14);

  // Score box
  const scoreX = MARGIN + CONTENT_W / 2 + 3;
  drawRoundedRect(pdf, scoreX, y, CONTENT_W / 2 - 3, 18, 2, "#f8fafc");
  pdf.setDrawColor(C.accent);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(scoreX, y, CONTENT_W / 2 - 3, 18, 2, 2, "S");

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(C.gray);
  pdf.text("Quality Score", scoreX + 4, y + 6);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(C.accent);
  pdf.text(String(vm.qualityScore), scoreX + 4, y + 14);

  return y + 24;
}

// ── Page 2: Kanban summary + case table ──────────────────────

function drawKanbanSummary(pdf: PDF, kanban: KanbanData, y: number): number {
  y = ensureSpace(pdf, y, 30);

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(C.navy);
  pdf.text("Kanban — Resumo por Coluna", MARGIN, y);
  y += 7;

  const cols: { key: keyof KanbanData; label: string; color: string }[] = [
    { key: "pass", label: "Pass", color: C.pass },
    { key: "fail", label: "Fail", color: C.fail },
    { key: "blocked", label: "Blocked", color: C.blocked },
    { key: "notRun", label: "Not Run", color: C.notRun },
  ];

  const colW = CONTENT_W / cols.length;
  cols.forEach((col, idx) => {
    const x = MARGIN + idx * colW;
    const count = kanban[col.key].length;

    drawRoundedRect(pdf, x + 1, y, colW - 2, 14, 2, "#f8fafc");
    drawColoredCircle(pdf, x + 5, y + 5, 2, col.color);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(C.navy);
    pdf.text(col.label, x + 10, y + 6);
    pdf.setFontSize(12);
    pdf.text(String(count), x + 10, y + 12);
  });

  return y + 20;
}

function drawCaseTable(pdf: PDF, kanban: KanbanData, y: number): number {
  const allCases: { item: KanbanItem; status: string; statusColor: string }[] = [];
  const addCases = (items: KanbanItem[], status: string, color: string) => {
    items.forEach((item) => allCases.push({ item, status, statusColor: color }));
  };
  addCases(kanban.pass, "Pass", C.pass);
  addCases(kanban.fail, "Fail", C.fail);
  addCases(kanban.blocked, "Blocked", C.blocked);
  addCases(kanban.notRun, "Not Run", C.notRun);

  if (allCases.length === 0) return y;

  y = ensureSpace(pdf, y, 20);

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(C.navy);
  pdf.text("Casos de Teste", MARGIN, y);
  y += 6;

  // Table header
  drawRoundedRect(pdf, MARGIN, y, CONTENT_W, 7, 1, C.headerBg);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(C.white);
  pdf.text("ID", MARGIN + 2, y + 5);
  pdf.text("Título", MARGIN + 18, y + 5);
  pdf.text("Status", MARGIN + CONTENT_W - 38, y + 5);
  pdf.text("Bug", MARGIN + CONTENT_W - 16, y + 5);
  y += 8;

  const rowH = 5.5;
  for (const { item, status, statusColor } of allCases) {
    y = ensureSpace(pdf, y, rowH + 1);

    const isEven = allCases.indexOf(allCases.find((c) => c.item === item)!) % 2 === 0;
    if (isEven) {
      pdf.setFillColor("#f8fafc");
      pdf.rect(MARGIN, y - 3.5, CONTENT_W, rowH, "F");
    }

    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(C.navy);

    const idStr = String(item.id).slice(0, 12);
    pdf.text(idStr, MARGIN + 2, y);

    const maxTitleW = CONTENT_W - 62;
    const titleStr = pdf.splitTextToSize(item.title || "-", maxTitleW)[0] || "-";
    pdf.text(titleStr, MARGIN + 18, y);

    drawColoredCircle(pdf, MARGIN + CONTENT_W - 38, y - 1, 1.2, statusColor);
    pdf.text(status, MARGIN + CONTENT_W - 35, y);

    pdf.setTextColor(C.fail);
    pdf.text(item.bug ? "Sim" : "-", MARGIN + CONTENT_W - 16, y);

    y += rowH;
  }

  return y + 4;
}

function drawTimeline(pdf: PDF, vm: RunDetailViewModel, y: number): number {
  if (!vm.timeline.length) return y;

  y = ensureSpace(pdf, y, 20);
  drawHorizontalLine(pdf, y);
  y += 6;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(C.navy);
  pdf.text("Timeline", MARGIN, y);
  y += 6;

  for (const event of vm.timeline.slice(0, 15)) {
    y = ensureSpace(pdf, y, 6);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(C.gray);

    const dateStr = new Date(event.occurred_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    pdf.text(dateStr, MARGIN, y);
    pdf.setTextColor(C.navy);
    pdf.text(event.label.slice(0, 80), MARGIN + 35, y);
    y += 5;
  }

  return y + 2;
}

function drawFooter(pdf: PDF) {
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(C.gray);
    pdf.text("Testing Company — Relatório de Run", MARGIN, PAGE_H - 8);
    pdf.text(`Página ${i} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
  }
}

// ── Public API ───────────────────────────────────────────────

export async function generateRunPdf(
  companySlug: string,
  releaseSlug: string,
): Promise<Buffer | null> {
  const vm = await getRunDetailViewModel(releaseSlug, companySlug !== "demo" ? companySlug : undefined);
  if (!vm) return null;

  // Load kanban data
  let kanban: KanbanData = { pass: [], fail: [], blocked: [], notRun: [] };
  if (vm.source === "API" && vm.runId != null) {
    try {
      kanban = await getQaseRunKanban(vm.projectCode, vm.runId, vm.companySlug);
    } catch {
      /* ignore */
    }
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  // Page 1
  let y = drawHeader(pdf, vm);
  y = drawMetadata(pdf, vm, y);
  y = drawStatsBlock(pdf, vm, y);
  y = drawGateScore(pdf, vm, y);
  y = drawTimeline(pdf, vm, y);

  // Page 2 — kanban
  const totalCases =
    kanban.pass.length + kanban.fail.length + kanban.blocked.length + kanban.notRun.length;
  if (totalCases > 0) {
    pdf.addPage();
    let y2 = MARGIN;
    y2 = drawKanbanSummary(pdf, kanban, y2);
    drawCaseTable(pdf, kanban, y2);
  }

  drawFooter(pdf);

  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
