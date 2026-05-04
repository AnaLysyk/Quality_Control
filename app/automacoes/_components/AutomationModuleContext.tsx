"use client";

import { createContext, useContext } from "react";

import type { ClientAccess } from "@/context/ClientContext";
import type { AutomationAccess } from "@/lib/automations/access";

export type AutomationModuleContextValue = {
  access: AutomationAccess;
  activeClient: ClientAccess | null;
  clients: ClientAccess[];
};

const AutomationModuleContext = createContext<AutomationModuleContextValue | null>(null);

export function AutomationModuleProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AutomationModuleContextValue;
}) {
  return <AutomationModuleContext.Provider value={value}>{children}</AutomationModuleContext.Provider>;
}

export function useAutomationModuleContext() {
  const context = useContext(AutomationModuleContext);
  if (!context) {
    throw new Error("useAutomationModuleContext must be used within <AutomationModuleProvider />.");
  }
  return context;
}
