import type { SystemPermission } from "@/lib/navigation/navigation.types";

export type BrainGraphSourceStatus = "ok" | "empty" | "disabled" | "blocked_by_permission" | "error";

export type BrainGraphSourceHealth = {
  id: string;
  label: string;
  status: BrainGraphSourceStatus;
  nodes: number;
  edges: number;
  message?: string;
  error?: string;
};

export type BrainGraphSource<TContext = unknown> = {
  id: string;
  label: string;
  enabled: boolean;
  requiredPermissions: SystemPermission[];
  buildNodes?: (context: TContext) => Promise<unknown[]>;
  buildEdges?: (context: TContext) => Promise<unknown[]>;
  healthCheck: (context: TContext) => Promise<BrainGraphSourceHealth>;
};
