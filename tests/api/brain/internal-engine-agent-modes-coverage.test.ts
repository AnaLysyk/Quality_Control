jest.mock("@/database/prismaClient", () => ({
  prisma: {
    ticket: { findMany: jest.fn() },
    release: { findMany: jest.fn() },
    accessRequest: { findMany: jest.fn() },
    supportRequest: { findMany: jest.fn() },
    company: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    application: { findMany: jest.fn() },
    companyIntegration: { findMany: jest.fn() },
    manualTestPlan: { findMany