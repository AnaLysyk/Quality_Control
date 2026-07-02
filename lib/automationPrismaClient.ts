import { PrismaClient } from "@prisma/client";
import {
  getPrismaClientOptions,
  resetPrismaAdapter,
} from "@/lib/prismaClientOptions";

const globalForAutomationPrisma = globalThis as unknown as {
  automationPrisma?: PrismaClient;
};

function hasDatabaseUrl() {
  return Boolean(
    process.env.DATABASE_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL,
  );
}

function isPrismaOptionalMode() {
  return process.env.E2E_USE_JSON === "1";
}

function createUnavailablePrismaClient(): PrismaClient {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined;
        throw new Error(
          "Automation Prisma client is unavailable (no DATABASE_URL) while E2E_USE_JSON=1 is active.",
        );
      },
    },
  ) as unknown as PrismaClient;
}

function createAutomationPrismaClient() {
  return new PrismaClient(getPrismaClientOptions());
}

function recreateAutomationPrismaClient() {
  resetPrismaAdapter();
  const client = createAutomationPrismaClient();
  globalForAutomationPrisma.automationPrisma = client;
  return client;
}

let currentAutomationPrisma: PrismaClient =
  globalForAutomationPrisma.automationPrisma ??
  (hasDatabaseUrl()
    ? createAutomationPrismaClient()
    : isPrismaOptionalMode()
      ? createUnavailablePrismaClient()
      : createAutomationPrismaClient());

function createAutomationPrismaClientProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      const value = Reflect.get(currentAutomationPrisma as object, prop, currentAutomationPrisma);
      return typeof value === "function" ? value.bind(currentAutomationPrisma) : value;
    },
    set(_target, prop, value) {
      return Reflect.set(currentAutomationPrisma as object, prop, value, currentAutomationPrisma);
    },
  });
}

export const automationPrisma: PrismaClient = createAutomationPrismaClientProxy();

if (process.env.NODE_ENV !== "production") {
  globalForAutomationPrisma.automationPrisma = currentAutomationPrisma;
}

export function reconnectAutomationPrisma() {
  console.info("[automation-prisma] Reconnecting after connection loss...");
  currentAutomationPrisma = recreateAutomationPrismaClient();
}

