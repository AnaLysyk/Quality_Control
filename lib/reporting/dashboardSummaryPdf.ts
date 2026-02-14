import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { DashboardSummaryResult } from "@/lib/services/dashboardSummary";


// Constantes de layout do PDF (A4 portrait)
const PAGE_WIDTH = 595.28; // A4 portrait width in points
const PAGE_HEIGHT = 841.89; // A4 portrait height in points
const PAGE_MARGIN = 48;
const LINE_GAP = 16;


/**
 * Quebra texto em múltiplas linhas para caber no PDF.
 */
function wrapText(text: string, size: number, maxWidth: number, font: PDFFont): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}


/**
 * Formata score numérico para exibição.
 */
function formatScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Math.round(value * 10) / 10}`;
}


/**
 * Formata horas para exibição.
 */
function formatHours(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Math.round(value * 10) / 10}h`;
}


/**
 * Formata data/hora para exibição.
 */
function formatDateTime(date: Date): string {
  return date.toISOString();
}


/**
 * Resolve label do período exibido no relatório.
 */
function resolvePeriodLabel(periodKey: string, periodLabel?: string): string {
  if (periodLabel) return periodLabel;
  if (periodKey === "all") return "Todos os registros";
  return `Ultimos ${periodKey}`;
}


/**
 * Opções para geração do PDF de resumo executivo do dashboard.
 */
export type DashboardSummaryPdfOptions = {
  companyName: string;
  companySlug: string;
  summary: DashboardSummaryResult;
  periodKey: string;
  periodLabel?: string;
  generatedAt?: Date;
  slaHours?: number | null;
  requestedBy?: { id?: string | null; email?: string | null; name?: string | null } | null;
};

/**
 * Gera o PDF de resumo executivo de qualidade para o dashboard.
 */
export async function buildDashboardSummaryPdf(options: DashboardSummaryPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let cursor = page.getHeight() - PAGE_MARGIN;
  const contentWidth = page.getWidth() - PAGE_MARGIN * 2;

  function ensureSpace(lines: number) {
    if (cursor - lines * LINE_GAP <= PAGE_MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursor = page.getHeight() - PAGE_MARGIN;
    }
  }

  function drawHeading(text: string) {
    ensureSpace(2);
    page.drawText(text, {
      x: PAGE_MARGIN,
      y: cursor,
      size: 18,
      font: bold,
      color: rgb(0.1, 0.1, 0.1),
    });
    cursor -= 28;
  }

  function drawSubheading(text: string) {
    ensureSpace(1);
    page.drawText(text, {
      x: PAGE_MARGIN,
      y: cursor,
      size: 14,
      font: bold,
      color: rgb(0.15, 0.15, 0.15),
    });
    cursor -= 22;
  }

  function drawParagraph(text: string, fontSize = 11) {
    const lines = wrapText(text, fontSize, contentWidth, regular);
    for (const line of lines) {
      ensureSpace(1);
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: cursor,
        size: fontSize,
        font: regular,
        color: rgb(0.2, 0.2, 0.2),
      });
      cursor -= LINE_GAP;
    }
    cursor -= 6;
  }

  function drawKeyValue(label: string, value: string) {
    ensureSpace(1);
    page.drawText(`${label}:`, {
      x: PAGE_MARGIN,
      y: cursor,
      size: 11,
      font: bold,
      color: rgb(0.15, 0.15, 0.15),
    });
    page.drawText(value, {
      x: PAGE_MARGIN + 130,
      y: cursor,
      size: 11,
      font: regular,
      color: rgb(0.2, 0.2, 0.2),
    });
    cursor -= LINE_GAP;
  }

  const generatedAt = options.generatedAt ?? new Date();
  const requestedBy = options.requestedBy;
  const summary = options.summary;

  drawHeading("Relatorio Executivo de Qualidade");
  drawParagraph(`Empresa: ${options.companyName || options.companySlug}`);
  drawParagraph(`Periodo: ${resolvePeriodLabel(options.periodKey, options.periodLabel)}`);
  drawParagraph(`Gerado em: ${formatDateTime(generatedAt)}`);
  if (requestedBy && (requestedBy.email || requestedBy.name || requestedBy.id)) {
    const actor = [requestedBy.name, requestedBy.email, requestedBy.id]
      .filter((value) => typeof value === "string" && value.length > 0)
      .join(" / ");
    drawParagraph(`Solicitado por: ${actor}`);
  }
  if (options.slaHours && options.slaHours > 0) {
    drawParagraph(`SLA considerado: ${options.slaHours}h`);
  }
  cursor -= 10;

  drawSubheading("Resumo Geral");
  drawKeyValue("Score", formatScore(summary.score));
  drawKeyValue("Quality Score", formatScore(summary.quality_score));
  drawKeyValue("MTTR", formatHours(summary.mttr.value));
  drawKeyValue("Defeitos Abertos", String(summary.defects.open));
  drawKeyValue("Acima do SLA", String(summary.defects.overSla));
  cursor -= 8;

  drawSubheading("Releases Impactadas");
  if (summary.releases.length === 0) {
    drawParagraph("Nenhuma release encontrada no periodo selecionado.");
  } else {
    summary.releases.forEach((release) => {
      drawParagraph(`- ${release.version} (${release.status})`);
    });
  }
  cursor -= 8;

  drawSubheading("Alertas Recentes");
  if (summary.alerts.length === 0) {
    drawParagraph("Nenhum alerta registrado no periodo.");
  } else {
    summary.alerts.forEach((alert) => {
      const rawTitle = (alert as { title?: unknown }).title;
      const rawType = (alert as { type?: unknown }).type;
      const rawMessage = (alert as { message?: unknown }).message;
      const descriptor = [rawTitle, rawType, rawMessage, alert.id]
        .find((value) => typeof value === "string" && value.length > 0) ?? "Alerta";
      const timestamp = typeof alert.timestamp === "string" && alert.timestamp.length > 0 ? alert.timestamp : "sem data";
      drawParagraph(`- ${descriptor} em ${timestamp}`);
    });
  }
  cursor -= 8;

  drawSubheading("Observacoes");
  drawParagraph(
    "Este relatorio reflete os dados disponiveis no periodo selecionado. Para detalhes adicionais, consulte o painel operacional ou exportes especificos de release.",
  );

  return doc.save();
}
