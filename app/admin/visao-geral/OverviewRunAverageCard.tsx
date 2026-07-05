"use client";

import { useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";

type OverviewPayload = {
  averageApprovalTimeMs?: number | null;
  averageApprovalTimeLabel?: string | null;
};

const CARD_ID = "overview-run-average-card";

function formatAverageDuration(ms: number | null | undefined) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return "--";

  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}min`;

  const hours = Math.round((ms / 3600000) * 10) / 10;
  if (hours < 24) return `${hours}h`;

  const days = Math.round((ms / 86400000) * 10) / 10;
  return `${days}d`;
}

function resolveAverageRunDuration(payload: OverviewPayload | null) {
  if (payload?.averageApprovalTimeLabel && payload.averageApprovalTimeLabel !== "--") return payload.averageApprovalTimeLabel;
  return formatAverageDuration(payload?.averageApprovalTimeMs);
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

export default function OverviewRunAverageCard() {
  useEffect(() => {
    let disposed = false;
    let latestValue = "--";

    async function loadAverage() {
      try {
        const response = await fetchApi("/api/admin/quality/overview?period=30", { cache: "no-store" });
        const json = await response.json().catch(() => null);
        const payload = response.ok ? unwrapEnvelopeData<OverviewPayload>(json) ?? json : null;
        latestValue = resolveAverageRunDuration(payload);
      } catch {
        latestValue = "--";
      }

      if (!disposed) upsertCard(latestValue);
    }

    void loadAverage();

    const observer = new MutationObserver(() => {
      if (!disposed) upsertCard(latestValue);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
