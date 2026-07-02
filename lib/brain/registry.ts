import "server-only";

export type BrainScreenActionKind = "navigate" | "open-modal" | "run-command" | "destructive";

export type BrainScreenAction = {
  id: string;
  label: string;
  description?: string;
  kind?: BrainScreenActionKind;
  route?: string;
  requiresConfirmation?: boolean;
};

export type BrainScreenRegistration = {
  id: string;
  title: string;
  description?: string;
  module?: string;
  entity?: string;
  permissions?: string[];
  faq?: Array<{ question: string; answer: string }>;
  actions?: BrainScreenAction[];
  workflows?: string[];
  documentation?: string[];
  examples?: string[];
  shortcuts?: Array<{ key: string; description: string }>;
};

const screenRegistry = new Map<string, BrainScreenRegistration>();

export function registerScreen(screen: BrainScreenRegistration) {
  screenRegistry.set(screen.id, {
    ...screen,
    faq: screen.faq ?? [],
    actions: screen.actions ?? [],
    workflows: screen.workflows ?? [],
    documentation: screen.documentation ?? [],
    examples: screen.examples ?? [],
    shortcuts: screen.shortcuts ?? [],
  });
}

export function getRegisteredScreen(id: string) {
  return screenRegistry.get(id) ?? null;
}

export function listRegisteredScreens() {
  return Array.from(screenRegistry.values()).sort((left, right) => left.title.localeCompare(right.title));
}


