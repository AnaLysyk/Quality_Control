jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  isPrismaConfigured: jest.fn(() => true),
  prisma: {
    user: {
      count: jest.fn(),
    },
    company: {
      count: jest.fn(),
    },
    release: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    testRun: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

import { NextRequest } from 'next/server';
import { GET } from '@/api/metrics/overview/route';
import { getRedis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

const getRedisMock = getRedis as unknown as jest.Mock;
const userCountMock = prisma.user.count as jest.Mock;
const companyCountMock = prisma.company.count as jest.Mock;
const releaseCountMock = prisma.release.count as jest.Mock;
const releaseFindManyMock = prisma.release.findMany as jest.Mock;
const releaseGroupByMock = prisma.release.groupBy as jest.Mock;
const testRunCountMock = prisma.testRun.count as jest.Mock;
const testRunGroupByMock = prisma.testRun.groupBy as jest.Mock;

describe('/api/metrics/overview', () => {
  beforeEach(() => {
    // Mock Redis client
    const mockRedisClient = {
      get: jest.fn().mockResolvedValue('5'), // 5 active sessions
    };
    getRedisMock.mockResolvedValue(mockRedisClient);

    // Mock Prisma queries
    userCountMock.mockResolvedValue(100);
    companyCountMock.mockResolvedValue(25);
    releaseCountMock.mockResolvedValue(50);
    testRunCountMock.mockResolvedValue(200);

    releaseFindManyMock.mockResolvedValue([
      { status: 'draft' },
      { status: 'published' },
      { status: 'published' },
      { status: 'archived' },
    ]);

    releaseGroupByMock.mockResolvedValue([
      { status: 'draft', _count: { status: 10 } },
      { status: 'published', _count: { status: 30 } },
      { status: 'archived', _count: { status: 10 } },
    ]);

    testRunGroupByMock.mockResolvedValue([
      { status: 'passed', _count: { status: 120 } },
      { status: 'failed', _count: { status: 30 } },
      { status: 'blocked', _count: { status: 25 } },
      { status: 'skipped', _count: { status: 25 } },
    ]);
  });

  it('should return system metrics', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('overview');
    expect(data).toHaveProperty('testStats');
    expect(data).toHaveProperty('releaseStats');
    expect(data).toHaveProperty('lastUpdated');

    // Verificar estrutura dos dados
    expect(data.overview).toHaveProperty('totalUsers');
    expect(data.overview).toHaveProperty('totalCompanies');
    expect(data.overview).toHaveProperty('totalReleases');
    expect(data.overview).toHaveProperty('totalTestRuns');
    expect(data.overview).toHaveProperty('activeSessions');

    expect(data.testStats).toHaveProperty('total');
    expect(data.testStats).toHaveProperty('passed');
    expect(data.testStats).toHaveProperty('failed');
    expect(data.testStats).toHaveProperty('blocked');
    expect(data.testStats).toHaveProperty('skipped');

    expect(data.releaseStats).toHaveProperty('draft');
    expect(data.releaseStats).toHaveProperty('published');
    expect(data.releaseStats).toHaveProperty('archived');

    // Verificar tipos
    expect(typeof data.overview.totalUsers).toBe('number');
    expect(typeof data.overview.totalCompanies).toBe('number');
    expect(typeof data.overview.totalReleases).toBe('number');
    expect(typeof data.overview.totalTestRuns).toBe('number');
    expect(typeof data.overview.activeSessions).toBe('number');
    expect(typeof data.lastUpdated).toBe('string');
  });
});
