import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { hasGlobalCompanyVisibility, resolveAllowedCompanySlugs } from "@/lib/companyDefectsAccess";
import { listLocalCompanies } from "@/lib/auth/localStore";

type OperationSignal = {
  id: string;
  type: "run" | "defect" | "automation" | "integration";
  title: string;
  companySlug: string;
  companyName: string;
  application: string;
  module: string;
  status: "new" | "analyzing" | "in_progress" | "blocked" | "resolved" | "failed" | "alert";
  owner: string;
  severity: "critical" | "high" | "medium" | "low";
  priority: "P0" | "P1" | "P2" | "P3";
  runCode: string;
  defectCode: string;
  updatedAtIso: string;
  passRate?: number;
  failCount?: number;
  durationMin?: number;
};

type OperationHistoryItem = {
  id: string;
  title: string;
  companyName: string;
  module: string;
  updatedAtIso: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function parseItemsFromPayload(payload: unknown, ...keys: string[]) {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (!root) return [];

  for (const key of keys) {
    const direct = root[key];
    if (Array.isArray(direct)) return direct;
  }

  const dataNode = root.data;
  if (Array.isArray(dataNode)) return dataNode;
  const dataRecord = asRecord(dataNode);
  if (dataRecord) {
    for (const key of keys) {
      const nested = dataRecord[key];
      if (Array.isArray(nested)) return nested;
    }
  }

  return [];
}

function mapSeverity(value: unknown): OperationSignal["severity"] {
  const raw = asString(value).toLowerCase();
  if (raw.includes("crit")) return "critical";
  if (raw.includes("high") || raw.includes("alta")) return "high";
  if (raw.includes("low") || raw.includes("baixa")) return "low";
  return "medium";
}

function mapPriority(value: unknown): OperationSignal["priority"] {
  const raw = asString(value).toUpperCase();
  if (raw === "P0" || raw === "P1" || raw === "P2" || raw === "P3") {
    return raw as OperationSignal["priority"];
  }
  return "P2";
}

function mapDefectStatus(value: unknown): OperationSignal["status"] {
  const raw = asString(value).toLowerCase();
  if (raw.includes("done") || raw.includes("closed") || raw.includes("resolved") || raw.includes("aprovado")) return "resolved";
  if (raw.includes("block")) return "blocked";
  if (raw.includes("progress") || raw.includes("andamento")) return "in_progress";
  if (raw.includes("fail")) return "failed";
  if (raw.includes("alert")) return "alert";
  if (raw.includes("anal")) return "analyzing";
  return "new";
}

function mapRunStatus(value: unknown): OperationSignal["status"] {
  const raw = asString(value).toLowerCase();
  if (!raw) return "in_progress";
  if (raw.includes("fail")) return "failed";
  if (raw.includes("block")) return "blocked";
  if (raw.includes("done") || raw.includes("pass") || raw.includes("success") || raw.includes("completed")) return "resolved";
  if (raw.includes("alert")) return "alert";
  return "in_progress";
}

type PeriodBounds = {
  period: string;
  fromMs: number;
  toMs: number;
  fromSec: number;
};

function parseDateBoundary(value: string | null, boundary: "start" | "end") {
  if (!value) return null;
  const date = new Date(`${value}T${boundary === "start" ? "00:00:00" : "23:59:59"}`);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function resolvePeriodBounds(url: URL): PeriodBounds {
  const now = new Date();
  const nowMs = now.getTime();
  const rawPeriod = asString(url.searchParams.get("period"), "24h").toLowerCase();
  const period = rawPeriod === "month" ? "this_month" : rawPeriod;

  if (period === "7d") {
    const fromMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    return { period, fromMs, toMs: nowMs, fromSec: Math.floor(fromMs / 1000) };
  }

  if (period === "30d") {
    const fromMs = nowMs - 30 * 24 * 60 * 60 * 1000;
    return { period, fromMs, toMs: nowMs, fromSec: Math.floor(fromMs / 1000) };
  }

  if (period === "this_month") {
    const fromMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return { period, fromMs, toMs: nowMs, fromSec: Math.floor(fromMs / 1000) };
  }

  if (period === "previous_month") {
    const fromMs = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const toMs = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
    return { period, fromMs, toMs, fromSec: Math.floor(fromMs / 1000) };
  }

  if (period === "custom") {
    const fromMs = parseDateBoundary(url.searchParams.get("dateFrom") ?? url.searchParams.get("from"), "start") ?? nowMs - 30 * 24 * 60 * 60 * 1000;
    const toMs = parseDateBoundary(url.searchParams.get("dateTo") ?? url.searchParams.get("to"), "end") ?? nowMs;
    return { period, fromMs, toMs, fromSec: Math.floor(fromMs / 1000) };
  }

  const fromMs = nowMs - 24 * 60 * 60 * 1000;
  return { period: "24h", fromMs, toMs: nowMs, fromSec: Math.floor(fromMs / 1000) };
}

function isInsidePeriod(value: string, bounds: PeriodBounds) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return time >= bounds.fromMs && time <= bounds.toMs;
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const periodBounds = resolvePeriodBounds(url);

  const requestedSlugs = Array.from(
    new Set(
      [
        ...url.searchParams.getAll("companySlug"),
        ...asString(url.searchParams.get("companySlugs")).split(","),
      ]
        .map((value) => normalizeSlug(value))
        .filter((value) => Boolean(value)),
    ),
  );

  const allowedSlugs = resolveAllowedCompanySlugs(auth).map((slug) => normalizeSlug(slug));
  const isPrivileged = hasGlobalCompanyVisibility(auth);

  const companies = await listLocalCompanies();
  const companyNameMap = new Map(
    companies.map((company) => [normalizeSlug(company.slug), company.name]),
  );
  const allCompanySlugs = companies
    .map((company) => normalizeSlug(company.slug))
    .filter((slug) => Boolean(slug));

  const effectiveSlugs =
    requestedSlugs.length > 0
      ? requestedSlugs.filter((slug) => isPrivileged || allowedSlugs.includes(slug))
      : isPrivileged
        ? allCompanySlugs
        : allowedSlugs.filter((slug) => allCompanySlugs.length === 0 || allCompanySlugs.includes(slug));

  if (effectiveSlugs.length === 0) {
    return NextResponse.json({
      period: periodBounds.period,
      periodFrom: new Date(periodBounds.fromMs).toISOString(),
      periodTo: new Date(periodBounds.toMs).toISOString(),
      signals: [],
      history: [],
      companies: [],
      warnings: ["Nenhuma empresa permitida"],
    }, { status: 200 });
  }

  const baseUrl = `${url.protocol}//${url.host}`;
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");
  if (cookie) headers.set("cookie", cookie);
  if (authorization) headers.set("authorization", authorization);

  const signals: OperationSignal[] = [];
  const history: OperationHistoryItem[] = [];
  const warnings: string[] = [];

  for (const slug of effectiveSlugs) {
    const companyName = companyNameMap.get(slug) ?? slug;

    const [runsRes, defectsRes, appsRes, summaryRes, docsRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/v1/runs?all=1&limit=100&companySlug=${encodeURIComponent(slug)}&from_start_time=${periodBounds.fromSec}`, { cache: "no-store", headers }),
      fetch(`${baseUrl}/api/company-defects?companySlug=${encodeURIComponent(slug)}`, { cache: "no-store", headers }),
      fetch(`${baseUrl}/api/applications?companySlug=${encodeURIComponent(slug)}`, { cache: "no-store", headers }),
      fetch(`${baseUrl}/api/dashboard/summary?slug=${encodeURIComponent(slug)}&period=${encodeURIComponent(periodBounds.period)}`, { cache: "no-store", headers }),
      fetch(`${baseUrl}/api/company-documents?slug=${encodeURIComponent(slug)}&history=1`, { cache: "no-store", headers }),
    ]);

    const runsJson = runsRes.status === "fulfilled" && runsRes.value.ok ? await parseJsonSafe(runsRes.value) : null;
    const defectsJson = defectsRes.status === "fulfilled" && defectsRes.value.ok ? await parseJsonSafe(defectsRes.value) : null;
    const appsJson = appsRes.status === "fulfilled" && appsRes.value.ok ? await parseJsonSafe(appsRes.value) : null;
    const summaryJson = summaryRes.status === "fulfilled" && summaryRes.value.ok ? await parseJsonSafe(summaryRes.value) : null;
    const docsJson = docsRes.status === "fulfilled" && docsRes.value.ok ? await parseJsonSafe(docsRes.value) : null;

    if (!runsJson) warnings.push(`Runs indisponiveis para ${companyName}`);
    if (!defectsJson) warnings.push(`Defeitos indisponiveis para ${companyName}`);

    const appItems = parseItemsFromPayload(appsJson, "items");
    const appNames = appItems
      .map((item) => asString(asRecord(item)?.name))
      .filter((value) => Boolean(value));

    const runItems = parseItemsFromPayload(runsJson, "data", "items");
    runItems.forEach((item, index) => {
      const row = asRecord(item);
      if (!row) return;

      const runIdRaw = row.runId ?? row.id ?? row.slug ?? `run-${index}`;
      const runCode = asString(runIdRaw, `RUN-${index + 1}`).toUpperCase();
      const projectCode = asString(row.project ?? row.app ?? row.qaseProject, appNames[0] ?? "N/A");
      const status = mapRunStatus(row.status ?? row.state ?? row.result);
      const owner = asString(row.responsibleLabel ?? row.responsibleName ?? row.createdByName, "Sem responsavel");
      const updatedAt = asString(row.createdAt ?? row.created_at ?? row.updatedAt, new Date().toISOString());

      signals.push({
        id: `${slug}-run-${runIdRaw}-${index}`,
        type: "run",
        title: asString(row.title ?? row.name, `Run ${runCode}`),
        companySlug: slug,
        companyName,
        application: projectCode,
        module: "Runs",
        status,
        owner,
        severity: status === "failed" || status === "blocked" ? "high" : "medium",
        priority: status === "failed" ? "P1" : "P2",
        runCode,
        defectCode: "",
        updatedAtIso: updatedAt,
        passRate: typeof row.passRate === "number" ? row.passRate : undefined,
        failCount: typeof row.failCount === "number" ? row.failCount : undefined,
        durationMin: typeof row.durationMin === "number" ? row.durationMin : undefined,
      });
    });

    const defectItems = parseItemsFromPayload(defectsJson, "items", "defects");
    defectItems.forEach((item, index) => {
      const row = asRecord(item);
      if (!row) return;

      const defectCode = asString(row.slug ?? row.id, `DEF-${index + 1}`).toUpperCase();
      const projectCode = asString(row.projectCode ?? row.app, appNames[0] ?? "N/A");
      const status = mapDefectStatus(row.status ?? row.kanbanStatus);
      const owner = asString(row.assignedToName ?? row.assigneeName ?? row.ownerName, "Sem responsavel");
      const updatedAt = asString(row.openedAt ?? row.updatedAt ?? row.createdAt, new Date().toISOString());

      signals.push({
        id: `${slug}-def-${defectCode}-${index}`,
        type: "defect",
        title: asString(row.title, `Defeito ${defectCode}`),
        companySlug: slug,
        companyName,
        application: projectCode,
        module: "Defeitos",
        status,
        owner,
        severity: mapSeverity(row.severity),
        priority: mapPriority(row.priority),
        runCode: asString(row.runSlug ?? row.runCode),
        defectCode,
        updatedAtIso: updatedAt,
      });
    });

    const summaryAlerts = parseItemsFromPayload(summaryJson, "alerts");
    summaryAlerts.forEach((item, index) => {
      const row = asRecord(item);
      if (!row) return;

      const alertType = asString(row.type).toLowerCase();
      const severity = mapSeverity(row.severity);
      const asIntegration = alertType.includes("sla") || alertType.includes("mttr");

      signals.push({
        id: `${slug}-alert-${alertType}-${index}`,
        type: asIntegration ? "integration" : "automation",
        title: asString(row.message, "Alerta operacional"),
        companySlug: slug,
        companyName,
        application: "N/A",
        module: asIntegration ? "Integracoes" : "Automacoes",
        status: severity === "critical" ? "alert" : "analyzing",
        owner: "Sistema",
        severity,
        priority: severity === "critical" ? "P1" : "P2",
        runCode: "",
        defectCode: "",
        updatedAtIso: asString(row.timestamp, new Date().toISOString()),
      });
    });

    const docsHistoryItems = parseItemsFromPayload(docsJson, "history", "items");
    docsHistoryItems.slice(0, 8).forEach((item, index) => {
      const row = asRecord(item);
      if (!row) return;

      history.push({
        id: `${slug}-history-${index}`,
        title: asString(row.title ?? row.docTitle ?? row.action, "Atualizacao operacional"),
        companyName,
        module: "Documentos",
        updatedAtIso: asString(row.createdAt ?? row.timestamp, new Date().toISOString()),
      });
    });
  }

  const visibleSignals = signals.filter((signal) => isInsidePeriod(signal.updatedAtIso, periodBounds));
  const visibleHistory = history.filter((item) => isInsidePeriod(item.updatedAtIso, periodBounds));

  return NextResponse.json({
    period: periodBounds.period,
    periodFrom: new Date(periodBounds.fromMs).toISOString(),
    periodTo: new Date(periodBounds.toMs).toISOString(),
    companies: effectiveSlugs.map((slug) => ({ slug, name: companyNameMap.get(slug) ?? slug })),
    signals: visibleSignals,
    history: visibleHistory,
    warnings,
  });
}
