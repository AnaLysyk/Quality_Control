"use client";

import { useEffect } from "react";

type OverviewPayload = {
  averageApprovalTimeMs?: number | null;
  averageApprovalTimeLabel?: string | null;
};

type OverviewEnvelope = OverviewPayload & {
  data?: OverviewPayload | null;
};

type CachedOverviewFetch = {
  expiresAt: number;
  promise: Promise<Response>;
};

type OverviewWindow = Window & {
  __qcOverviewFetchPatched?: boolean;
  __qcOverviewFetchCache?: Map<string, CachedOverviewFetch>;
  __qcOverviewLastRunAverage?: string;
  __qcOverviewRunAverageListeners?: Set<(value: string) => void>;
};

const CARD_ID = "overview-run-average-card";
const OVERVIEW_PATH = "/api/admin/quality/overview";
const CACHE_MS = 6000;

function formatAverageDuration(ms: number | null | undefined) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return "--";

  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}min`;

  const hours = Math.round((ms / 3600000) * 10) / 10;
  if (hours < 24) return `${hours}h`;

  const days = Math.round((ms / 86400000) * 10) / 10;
  return `${days}d`;
}

function unwrapPayload(json: unknown): OverviewPayload | null {
  if (!json || typeof json !== "object") return null;
  const envelope = json as OverviewEnvelope;
  return envelope.data && typeof envelope.data === "object" ? envelope.data : envelope;
}

function resolveAverageRunDuration(payload: OverviewPayload | null) {
  if (payload?.averageApprovalTimeLabel && payload.averageApprovalTimeLabel !== "--") return payload.averageApprovalTimeLabel;
  return formatAverageDuration(payload?.averageApprovalTimeMs);
}

function getFetchKey(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET") return null;

  const rawUrl = input instanceof Request ? input.url : input.toString();
  const url = new URL(rawUrl, window.location.origin);
  if (url.pathname !== OVERVIEW_PATH) return null;

  url.searchParams.sort();
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function publishAverage(value: string) {
  const overviewWindow = window as OverviewWindow;
  overviewWindow.__qcOverviewLastRunAverage = value;
  overviewWindow.__qcOverviewRunAverageListeners?.forEach((listener) => listener(value));
}

function installOverviewFetchReuse() {
  if (typeof window === "undefined") return;

  const overviewWindow = window as OverviewWindow;
  if (overviewWindow.__qcOverviewFetchPatched) return;

  overviewWindow.__qcOverviewFetchPatched = true;
  overviewWindow.__qcOverviewFetchCache = overviewWindow.__qcOverviewFetchCache ?? new Map();
  overviewWindow.__qcOverviewRunAverageListeners = overviewWindow.__qcOverviewRunAverageListeners ?? new Set();

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const key = getFetchKey(input, init);
    if (!key) return originalFetch(input, init);

    const cache = overviewWindow.__qcOverviewFetchCache!;
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.promise.then((response) => response.clone());
    }

    const promise = originalFetch(input, init).then((response) => {
      const cloneForMetric = response.clone();
      void cloneForMetric
        .json()
        .then((json) => publishAverage(resolveAverageRunDuration(unwrapPayload(json))))
        .catch(() => publishAverage("--"));
      return response;
    });

    cache.set(key, { expiresAt: now + CACHE_MS, promise });
    window.setTimeout(() => cache.delete(key), CACHE_MS);

    return promise.then((response) => response.clone());
  };
}

function findMetricGrid() {
  const sections = Array.from(document.querySelectorAll("section"));
  const hero = sections.find((section) => section.textContent?.includes("Visão Geral"));
  return hero?.querySelector(".mt-6.grid.gap-3") as HTMLElement | null;
}

function makeNode(tag: string, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCard() {
  const card = makeNode(
    "div",
    "group rounded-[26px] border border-white/15 bg-white/10 p-4 text-white shadow-[0_18px_38px_rgba(1,24,72,.12)] backdrop-blur-sm ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:bg-white/15",
  );
  card.id = CARD_ID;

  const top = makeNode("div", "flex items-start justify-between gap-3");
  top.appendChild(makeNode("div", "grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white/80", "⏱"));
  top.appendChild(makeNode("span", "mt-1 text-white/30", "↗"));

  const value = makeNode("b", "mt-4 block text-3xl leading-none tracking-[-.05em]", "--");
  value.setAttribute("data-run-average-value", "true");

  card.appendChild(top);
  card.appendChild(value);
  card.appendChild(makeNode("small", "mt-2 block text-xs font-black uppercase tracking-[.16em] text-white/62", "Execução média"));
  card.appendChild(makeNode("p", "mt-2 text-xs font-semibold text-white/52", "das runs"));

  return card;
}

function upsertCard(value: string) {
  const grid = findMetricGrid();
  if (!grid) return false;

  grid.className = grid.className.replace("xl:grid-cols-4", "xl:grid-cols-5");

  let card = document.getElementById(CARD_ID);
  if (!card) {
    card = createCard();
    grid.appendChild(card);
  }

  const valueNode = card.querySelector("[data-run-average-value]");
  if (valueNode) valueNode.textContent = value;
  return true;
}

installOverviewFetchReuse();

export default function OverviewRunAverageCard() {
  useEffect(() => {
    let latestValue = (window as OverviewWindow).__qcOverviewLastRunAverage ?? "--";
    const overviewWindow = window as OverviewWindow;
    const listener = (value: string) => {
      latestValue = value;
      upsertCard(latestValue);
    };

    overviewWindow.__qcOverviewRunAverageListeners?.add(listener);
    upsertCard(latestValue);

    const observer = new MutationObserver(() => upsertCard(latestValue));
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      overviewWindow.__qcOverviewRunAverageListeners?.delete(listener);
    };
  }, []);

  return null;
}
