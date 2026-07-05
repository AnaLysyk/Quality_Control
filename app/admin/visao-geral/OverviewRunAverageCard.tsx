"use client";

import { useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";

type OverviewPayload = {
  companies?: Array<{
    releases?: Array<Record<string, unknown>>;
  }>;
};

const CARD_ID = "overview-run-average-card";

function toTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string" || !value.trim()) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function releaseTimestamp(release: Record<string, unknown>) {
  return (
    toTimestamp(release.createdAtValue) ||
    toTimestamp(release.createdAt) ||
    toTimestamp(release.created_at) ||
    toTimestamp(release.startedAt) ||
    toTimestamp(release.started_at)
  );
}

function formatAverageDuration(ms: number | null) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return "--";

  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}min`;

  const hours = Math.round((ms / 3600000) * 10) / 10;
  if (hours < 24) return `${hours}h`;

  const days = Math.round((ms / 86400000) * 10) / 10;
  return `${days}d`;
}

function calculateAverageRunInterval(payload: OverviewPayload | null) {
  const releases = (payload?.companies ?? []).flatMap((company) => company.releases ?? []);
  const timestamps = Array.from(new Set(releases.map(releaseTimestamp).filter((time) => time > 0))).sort((left, right) => left - right);

  if (timestamps.length < 2) return null;

  const intervals = timestamps.slice(1).map((time, index) => time - timestamps[index]).filter((value) => value > 0);
  if (!intervals.length) return null;

  return Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length);
}

function findMetricGrid() {
  const sections = Array.from(document.querySelectorAll("section"));
  const hero = sections.find((section) => section.textContent?.includes("Visão Geral"));
  return hero?.querySelector(".mt-6.grid.gap-3") as HTMLElement | null;
}

function upsertCard(value: string) {
  const grid = findMetricGrid();
  if (!grid) return false;

  grid.className = grid.className.replace("xl:grid-cols-4", "xl:grid-cols-5");

  let card = document.getElementById(CARD_ID);
  if (!card) {
    card = document.createElement("div");
    card.id = CARD_ID;
    card.className = "group rounded-[26px] border border-white/15 bg-white/10 p-4 text-white shadow-[0_18px_38px_rgba(1,24,72,.12)] backdrop-blur-sm ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:bg-white/15";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white/80">⏱</div>
        <span class="mt-1 text-white/30">↗</span>
      </div>
      <b data-run-average-value class="mt-4 block text-3xl leading-none tracking-[-.05em]">--</b>
      <small class="mt-2 block text-xs font-black uppercase tracking-[.16em] text-white/62">Tempo médio</small>
      <p class="mt-2 text-xs font-semibold text-white/52">entre runs</p>
    `;
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
        latestValue = formatAverageDuration(calculateAverageRunInterval(payload));
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
