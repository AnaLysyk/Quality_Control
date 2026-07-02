import type { SystemPermission } from "@/lib/navigation/navigation.types";

export type BrainIntegrationProvider = "qase" | "jira";

export type BrainExternalSource = {
  provider: BrainIntegrationProvider;
  enabled: boolean;
  label: string;
  requiredPermissions: SystemPermission[];
  syncMode: "manual" | "scheduled" | "on_demand";
};

export type BrainExternalNodeSource = {
  type: "integration";
  provider: BrainIntegrationProvider;
  externalId: string;
  externalUrl?: string;
  syncedAt?: string;
};

export type BrainExternalNode = {
  id: string;
  type: string;
  label: string;
  description?: string | null;
  source: BrainExternalNodeSource;
  permissions: SystemPermission[];
  actions: string[];
  metadata: Record<string, unknown>;
};

