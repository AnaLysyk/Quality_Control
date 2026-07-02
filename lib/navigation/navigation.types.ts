import type { SystemRole } from "@/lib/auth/roles";

export type SystemMapStatus = "ativo" | "parcial" | "legado" | "oculto" | "quebrado" | "disabled";

export type SystemModuleId =
  | "empresas"
  | "usuarios"
  | "permissoes"
  | "testes-manuais"
  | "automacao"
  | "brain"
  | "assistente"
  | "chat"
  | "suporte"
  | "solicitacoes"
  | "documentos"
  | "dashboards"
  | "operacao"
  | "agenda"
  | "configuracoes";

export type SystemPermission = {
  moduleId: string;
  action: string;
};

export type SystemModuleDefinition = {
  id: SystemModuleId;
  name: string;
  description: string;
  mainRoute: string;
  basePermission: SystemPermission | null;
  status: SystemMapStatus;
};

export type SystemRouteDefinition = {
  id: string;
  moduleId: SystemModuleId;
  path: string;
  label: string;
  description: string;
  requiredPermission: SystemPermission | null;
  expectedProfiles: SystemRole[];
  status: SystemMapStatus;
  mainFile: string;
  notes?: string;
};

