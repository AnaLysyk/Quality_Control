import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

interface TestStatusCount {
  status: string;
  _count: {
    status: number;
  };
}

interface ReleaseStatusCount {
  status: string;
  _count: {
    status: number;
  };
}

export async function GET() {
  try {
    // Métricas básicas do sistema
    const [
      totalUsers,
      totalCompanies,
      totalReleases,
      totalTestRuns,
      activeSessions,
    ] = await Promise.all([
      // Total de usuários
      prisma.user.count(),

      // Total de empresas
      prisma.company.count(),

      // Total de releases
      prisma.release.count(),

      // Total de execuções de teste (últimos 30 dias)
      prisma.testRun.count({
        where: {
          created_at: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
          },
        },
      }),

      // Sessões ativas (contar chaves no Redis)
      (async () => {
        try {
          const redis = getRedis();
          const keys = await redis.keys('session:*');
          return keys.length;
        } catch {
          return 0;
        }
      })(),
    ]);

    // Status dos testes (últimos 30 dias)
    const testStatusCounts = await prisma.testRun.groupBy({
      by: ['status'],
      where: {
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      _count: {
        status: true,
      },
    });

    // Converter para formato mais fácil de usar
    const testStats = {
      total: testStatusCounts.reduce((sum: number, item: TestStatusCount) => sum + item._count.status, 0),
      passed: testStatusCounts.find((item: TestStatusCount) => item.status === 'passed')?._count.status || 0,
      failed: testStatusCounts.find((item: TestStatusCount) => item.status === 'failed')?._count.status || 0,
      blocked: testStatusCounts.find((item: TestStatusCount) => item.status === 'blocked')?._count.status || 0,
      skipped: testStatusCounts.find((item: TestStatusCount) => item.status === 'skipped')?._count.status || 0,
    };

    // Releases por status
    const releaseStatusCounts = await prisma.release.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const releaseStats = {
      draft: releaseStatusCounts.find((item: ReleaseStatusCount) => item.status === 'draft')?._count.status || 0,
      published: releaseStatusCounts.find((item: ReleaseStatusCount) => item.status === 'published')?._count.status || 0,
      archived: releaseStatusCounts.find((item: ReleaseStatusCount) => item.status === 'archived')?._count.status || 0,
    };

    return NextResponse.json({
      overview: {
        totalUsers,
        totalCompanies,
        totalReleases,
        totalTestRuns,
        activeSessions,
      },
      testStats,
      releaseStats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    );
  }
}