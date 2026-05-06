import { PrismaClient } from "@prisma/client";
import {
  getAutomationPrismaClientOptions,
  resetPrismaAdapter,
} from "@/lib/prismaClientOptions";

const globalForAutomationPrisma = globalThis as unknown as {
  automationPrisma?: PrismaClient;
};

function createAutomationPrismaClient() {
  return new PrismaClient(getAutomationPrismaClientOptions());
}

function recreateAutomationPrismaClient() {
  resetPrismaAdapter("automation");
  const client = createAutomationPrismaClient();
  globalForAutomationPrisma.automationPrisma = client;
  return client;
}

export let automationPrisma: PrismaClient =
  globalForAutomationPrisma.automationPrisma ?? createAutomationPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForAutomationPrisma.automationPrisma = automationPrisma;
}

export function reconnectAutomationPrisma() {
  console.info("[automation-prisma] Reconnecting after connection loss...");
  automationPrisma = recreateAutomationPrismaClient();
}
