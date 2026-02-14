import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { getReleaseTimeline, type TimelineEvent } from "@/lib/releaseTimeline";
import {
  readManualReleaseCases,
  readManualReleases,
  type ManualCaseItem,
} from "@/lib/manualReleaseStore";
import type { LocalAuthCompany } from "@/core/auth/localStore";
import { calcTotal, type Release, type Stats } from "@/types/release";

export type ReleaseExportCompany = Pick<LocalAuthCompany, "id" | "slug" | "name" | "company_name">;

export type ReleaseExportSummary = {
  totals: {
    stats: Stats;
    totalTests: number;
    passRate: number;
    failRate: number;
    blockedRate: number;
    notRunRate: number;
  };
  manualCases: {
    total: number;
    automated: number;
    manual: number;
    byStatus: Record<string, number>;
  };
  timeline: {
    totalEvents: number;
    firstEventAt: string | null;
    lastEventAt: string | null;
    byType: Record<string, number>;
  };
};

export type ReleaseContextCore = {
  company: ReleaseExportCompany;
  release: Release;
  manualCases: ManualCaseItem[];
  timeline: TimelineEvent[];
};

export type ReleaseExportContext = ReleaseContextCore & {
  summary: ReleaseExportSummary;
};

export class ReleaseExportError extends Error {
  constructor(
    public readonly code: "RELEASE_NOT_FOUND" | "RELEASE_FORBIDDEN",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ReleaseExportError";
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function releaseMatches(entry: Release, slug: string) {
  const target = normalize(slug);
  const candidates = [entry.slug, entry.id].filter(Boolean).map((item) => normalize(String(item)));
  return candidates.includes(target);
}

function releaseBelongsToCompany(release: Release, company: ReleaseExportCompany) {
  const companyId = normalize(company.id);
  const companySlug = company.slug ? normalize(company.slug) : null;
  const candidate = release.clientSlug ? normalize(release.clientSlug) : null;
  if (!candidate) return false;
  return candidate === companyId || candidate === companySlug;
}

function toSafeArray<T>(value: T[]): T[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function ensureStats(stats?: Stats | null): Stats {
  if (!stats) {
    return { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  }
  return stats;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString();
}

function computeSummary(release: Release, manualCases: ManualCaseItem[], timeline: TimelineEvent[]): ReleaseExportSummary {
  const stats = ensureStats(release.stats);
  const totalTests = calcTotal(stats);
  const passRate = totalTests > 0 ? Math.round((stats.pass / totalTests) * 1000) / 10 : 0;
  const failRate = totalTests > 0 ? Math.round((stats.fail / totalTests) * 1000) / 10 : 0;
  const blockedRate = totalTests > 0 ? Math.round((stats.blocked / totalTests) * 1000) / 10 : 0;
  const notRunRate = totalTests > 0 ? Math.round((stats.notRun / totalTests) * 1000) / 10 : 0;

  const statusCounts = manualCases.reduce<Record<string, number>>((acc, value) => {
    const status = (value.status ?? "UNKNOWN").toUpperCase();
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  const automated = manualCases.filter((item) => item.fromApi).length;
  const manual = manualCases.length - automated;

  const sortedTimeline = [...timeline].sort((a, b) => {
    const aTime = Date.parse(a.occurred_at ?? "");
    const bTime = Date.parse(b.occurred_at ?? "");
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return aTime - bTime;
  });

  const firstEventAt = sortedTimeline[0]?.occurred_at ? formatDate(sortedTimeline[0].occurred_at) : null;
  const lastEventAt = sortedTimeline.at(-1)?.occurred_at ? formatDate(sortedTimeline.at(-1)?.occurred_at) : null;

  const byType = timeline.reduce<Record<string, number>>((acc, value) => {
    const key = value.type ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totals: {
      stats,
      totalTests,
      passRate,
      failRate,
      blockedRate,
      notRunRate,
    },
    manualCases: {
      total: manualCases.length,
      automated,
      manual,
      byStatus: statusCounts,
    },
    timeline: {
      totalEvents: timeline.length,
      firstEventAt,
      lastEventAt,
      byType,
    },
  };
}

export async function loadReleaseContext(
  company: ReleaseExportCompany,
  releaseSlug: string,
): Promise<ReleaseContextCore> {
  const [releases, casesStore] = await Promise.all([readManualReleases(), readManualReleaseCases()]);
  const release = releases.find((entry) => releaseMatches(entry, releaseSlug));
  if (!release) {
    throw new ReleaseExportError("RELEASE_NOT_FOUND", "Release nao encontrada", 404);
  }

  if (!releaseBelongsToCompany(release, company)) {
    throw new ReleaseExportError("RELEASE_FORBIDDEN", "Release nao pertence a empresa", 403);
  }

  const manualCases = toSafeArray(casesStore[release.slug] ?? []);
  const timeline = await getReleaseTimeline(company.slug ?? company.id, release.slug);

  return {
    company,
    release,
    manualCases,
    timeline,
  };
}

export async function loadReleaseExportContext(
  company: ReleaseExportCompany,
  releaseSlug: string,
): Promise<ReleaseExportContext> {
  const base = await loadReleaseContext(company, releaseSlug);
  const summary = computeSummary(base.release, base.manualCases, base.timeline);

  return {
    ...base,
    summary,
  };
}

function toCsvLine(values: Array<string | number | null | undefined>) {
  return values
    .map((value) => {
      if (value == null) return "";
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/\"/g, "\"\"")}"`;
      }
      return text;
    })
    .join(",");
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function buildReleaseCsv(context: ReleaseExportContext): string {
  const lines: string[] = [];
  const { company, release, manualCases, timeline, summary } = context;
  const stats = ensureStats(summary.totals.stats);

  lines.push("section,field,value");
  lines.push(toCsvLine(["company", "id", company.id]));
  lines.push(toCsvLine(["company", "slug", company.slug ?? ""]));
  lines.push(toCsvLine(["company", "name", company.name ?? company.company_name ?? ""]));
  lines.push(toCsvLine(["release", "slug", release.slug]));
  lines.push(toCsvLine(["release", "name", release.name]));
  lines.push(toCsvLine(["release", "status", release.status]));
  lines.push(toCsvLine(["release", "created_at", formatDate(release.createdAt)]));
  lines.push(toCsvLine(["release", "updated_at", formatDate(release.updatedAt)]));
  lines.push(toCsvLine(["release", "closed_at", formatDate(release.closedAt ?? null)]));
  lines.push("");

  lines.push("metric,pass,fail,blocked,not_run,total,pass_rate,fail_rate,blocked_rate,not_run_rate");
  lines.push(
    toCsvLine([
      "test_stats",
      stats.pass,
      stats.fail,
      stats.blocked,
      stats.notRun,
      summary.totals.totalTests,
      formatPercent(summary.totals.passRate),
      formatPercent(summary.totals.failRate),
      formatPercent(summary.totals.blockedRate),
      formatPercent(summary.totals.notRunRate),
    ]),
  );
  lines.push("");

  lines.push("cases,status,link,bug,source");
  manualCases.forEach((manualCase) => {
    lines.push(
      toCsvLine([
        manualCase.title ?? manualCase.id,
        manualCase.status ?? "",
        manualCase.link ?? "",
        manualCase.bug ?? "",
        manualCase.fromApi ? "automated" : "manual",
      ]),
    );
  });
  lines.push("");

  lines.push("cases_summary,status,count");
  Object.entries(summary.manualCases.byStatus).forEach(([status, count]) => {
    lines.push(toCsvLine(["status", status, count]));
  });
  lines.push(toCsvLine(["totals", "manual", summary.manualCases.manual]));
  lines.push(toCsvLine(["totals", "automated", summary.manualCases.automated]));
  lines.push(toCsvLine(["totals", "total", summary.manualCases.total]));
  lines.push("");

  lines.push("timeline,id,type,label,occurred_at,meta");
  timeline.forEach((event) => {
    const meta = event.meta ? JSON.stringify(event.meta) : "";
    lines.push(toCsvLine(["event", event.id, event.type, event.label, formatDate(event.occurred_at), meta]));
  });
  lines.push("");

  lines.push("timeline_summary,type,count");
  Object.entries(summary.timeline.byType).forEach(([type, count]) => {
    lines.push(toCsvLine(["type", type, count]));
  });
  lines.push(toCsvLine(["totals", "events", summary.timeline.totalEvents]));
  lines.push(toCsvLine(["totals", "first_event", summary.timeline.firstEventAt ?? ""]));
  lines.push(toCsvLine(["totals", "last_event", summary.timeline.lastEventAt ?? ""]));

  return `\uFEFF${lines.join("\n")}\n`;
}

function wrapText(text: string, size: number, maxWidth: number, font: PDFFont) {
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

export async function buildReleasePdf(context: ReleaseExportContext): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let currentPage = doc.addPage([595.28, 841.89]); // A4 portrait
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let cursor = currentPage.getHeight() - margin;
  const maxWidth = currentPage.getWidth() - margin * 2;

  const lineGap = 16;

  function ensureSpace(lines: number) {
    if (cursor - lines * lineGap <= margin) {
      const newPage = doc.addPage([595.28, 841.89]);
      currentPage = newPage;
      cursor = newPage.getHeight() - margin;
      return currentPage;
    }
    return currentPage;
  }

  function drawHeading(text: string) {
    ensureSpace(1);
    currentPage.drawText(text, {
      x: margin,
      y: cursor,
      size: 18,
      font: bold,
      color: rgb(0.1, 0.1, 0.1),
    });
    cursor -= 24;
  }

  function drawSubheading(text: string) {
    ensureSpace(1);
    currentPage.drawText(text, {
      x: margin,
      y: cursor,
      size: 14,
      font: bold,
      color: rgb(0.15, 0.15, 0.15),
    });
    cursor -= 20;
  }

  function drawParagraph(text: string, fontSize = 11) {
    const lines = wrapText(text, fontSize, maxWidth, regular);
    for (const line of lines) {
      ensureSpace(1);
      currentPage.drawText(line, {
        x: margin,
        y: cursor,
        size: fontSize,
        font: regular,
        color: rgb(0.2, 0.2, 0.2),
      });
      cursor -= lineGap;
    }
    cursor -= 4;
  }

  function drawKeyValue(label: string, value: string) {
    ensureSpace(1);
    currentPage.drawText(`${label}:`, {
      x: margin,
      y: cursor,
      size: 11,
      font: bold,
      color: rgb(0.15, 0.15, 0.15),
    });
    currentPage.drawText(value, {
      x: margin + 120,
      y: cursor,
      size: 11,
      font: regular,
      color: rgb(0.2, 0.2, 0.2),
    });
    cursor -= lineGap;
  }

  const { company, release, summary } = context;

  drawHeading("Relatorio de Release");
  drawParagraph(`Empresa: ${company.name ?? company.company_name ?? company.slug ?? company.id}`);
  drawParagraph(`Gerado em: ${new Date().toISOString()}`);
  cursor -= 8;

  drawSubheading("Release");
  drawKeyValue("Nome", release.name ?? release.slug);
  drawKeyValue("Slug", release.slug);
  drawKeyValue("Status", release.status ?? "");
  drawKeyValue("Criada em", formatDate(release.createdAt));
  drawKeyValue("Atualizada em", formatDate(release.updatedAt));
  if (release.closedAt) {
    drawKeyValue("Fechada em", formatDate(release.closedAt));
  }
  cursor -= 8;

  drawSubheading("Estatisticas de Testes");
  const stats = ensureStats(summary.totals.stats);
  drawKeyValue("Total de casos", String(summary.totals.totalTests));
  drawKeyValue("Pass", `${stats.pass} (${formatPercent(summary.totals.passRate)})`);
  drawKeyValue("Fail", `${stats.fail} (${formatPercent(summary.totals.failRate)})`);
  drawKeyValue("Blocked", `${stats.blocked} (${formatPercent(summary.totals.blockedRate)})`);
  drawKeyValue("Not Run", `${stats.notRun} (${formatPercent(summary.totals.notRunRate)})`);
  cursor -= 8;

  drawSubheading("Casos Manuais");
  drawKeyValue("Total", String(summary.manualCases.total));
  drawKeyValue("Manuais", String(summary.manualCases.manual));
  drawKeyValue("Automatizados", String(summary.manualCases.automated));
  Object.entries(summary.manualCases.byStatus).forEach(([status, count]) => {
    drawKeyValue(`Status ${status}`, String(count));
  });
  cursor -= 8;

  drawSubheading("Timeline");
  drawKeyValue("Eventos", String(summary.timeline.totalEvents));
  drawKeyValue("Primeiro evento", summary.timeline.firstEventAt ?? "");
  drawKeyValue("Ultimo evento", summary.timeline.lastEventAt ?? "");
  Object.entries(summary.timeline.byType).forEach(([type, count]) => {
    drawKeyValue(`Evento ${type}`, String(count));
  });
  cursor -= 8;

  drawSubheading("Eventos Detalhados");
  context.timeline.forEach((event) => {
    const occurred = formatDate(event.occurred_at);
    drawParagraph(`- [${event.type}] ${event.label} (${occurred})`);
    if (event.meta && Object.keys(event.meta).length > 0) {
      drawParagraph(`   Meta: ${JSON.stringify(event.meta)}`, 10);
    }
  });

  return doc.save();
}

export function sanitizeForFilename(value: string) {
  return value.replace(/[^a-z0-9_.-]/gi, "_");
}
