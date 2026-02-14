import { NextResponse } from "next/server";

import { getRedis } from "@/lib/redis";
import { listLocalCompanies, listLocalUsers } from "@/lib/auth/localStore";
import { getAllReleases } from "@/release/data";
import { readManualReleaseStore } from "@/data/manualData";

export async function GET() {
  try {
    // Helper para unificar acesso a createdAt/created_at
    function pickCreatedAt(c: any): string | null {
      if (typeof c.createdAt === "string") return c.createdAt;
      if (typeof c.created_at === "string") return c.created_at;
      return null;
    }
    const [users, companies, releases, manualReleases, activeSessions] = await Promise.all([
      listLocalUsers(),
      listLocalCompanies(),
      getAllReleases(),
      readManualReleaseStore(),
      (async () => {
        try {
          const redis = getRedis();
          const keys = await redis.keys("session:*");
          return keys.length;
        } catch {
          return 0;
        }
      })(),
    ]);

    const releaseBySlug = new Map<string, { status?: string }>();
    releases.forEach((release) => releaseBySlug.set(release.slug, { status: release.status }));
    manualReleases.forEach((release) => {
      const rec = release as { slug?: unknown; status?: unknown };
      const slug = typeof rec.slug === "string" ? rec.slug : "";
      if (slug) releaseBySlug.set(slug, { status: typeof rec.status === "string" ? rec.status : undefined });
    });

    const totalReleases = releaseBySlug.size;
    const totalTestRuns = totalReleases;

    const releaseStats = {
      draft: 0,
      published: 0,
      archived: 0,
    };
    for (const entry of releaseBySlug.values()) {
      const status = (entry.status ?? "").toString().toLowerCase();
      if (status === "draft") releaseStats.draft += 1;
      if (status === "published") releaseStats.published += 1;
      if (status === "archived") releaseStats.archived += 1;
    }

    return NextResponse.json({
      overview: {
        totalUsers: users.length,
        totalCompanies: companies.length,
        totalReleases,
        totalTestRuns,
        activeSessions,
      },
      testStats: {
        total: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        skipped: 0,
      },
      releaseStats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json({ error: "Erro ao buscar metricas" }, { status: 500 });
  }
}

// Funções utilitárias (mantidas para PATCH futuro)
function sanitizeText(value: unknown, max = 255): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  // Regex leve para validar formato de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}
