import type {
  BrianActivationPolicy,
  BrianImpulseType,
  BrianNeuronKind,
  BrianSynapseRelation,
} from "./types";

export const BRIAN_SPEC_VERSION = "brian.v1" as const;

export const BRIAN_IMPULSE_TYPES: BrianImpulseType[] = [
  "defect.created",
  "defect.updated",
  "defect.status_changed",
  "test_case.created",
  "test_case.updated",
  "test_run.started",
  "test_run.failed",
  "automation.generated",
  "release.approved",
  "release.blocked",
  "ticket.created",
  "ticket.reopened",
  "ticket.updated",
  "comment.added",
  "file.attached",
  "permission.granted",
  "neuron.feedback_created",
];

export const BRIAN_NEURON_KINDS: BrianNeuronKind[] = [
  "company",
  "application",
  "module",
  "user",
  "role",
  "defect",
  "ticket",
  "test_case",
  "test_run",
  "automation",
  "release",
  "environment",
  "flow",
  "decision",
  "risk",
  "blocker",
  "comment",
  "attachment",
  "integration",
];

export const BRIAN_SYNAPSE_RELATIONS: BrianSynapseRelation[] = [
  "belongs_to",
  "created_by",
  "updated_by",
  "impacts",
  "blocks",
  "depends_on",
  "generated_by",
  "failed_in",
  "tested_by",
  "automated_by",
  "approved_by",
  "reopened_by",
  "resolved_by",
  "linked_to",
  "originated_from",
  "mentioned_in",
  "visible_to",
];

export type BrianAllowedRelation = {
  from: BrianNeuronKind;
  relation: BrianSynapseRelation;
  to: BrianNeuronKind;
  requiredEvidence: boolean;
};

export const BRIAN_ALLOWED_RELATIONS: BrianAllowedRelation[] = [
  { from: "defect", relation: "belongs_to", to: "company", requiredEvidence: true },
  { from: "defect", relation: "belongs_to", to: "module", requiredEvidence: true },
  { from: "defect", relation: "created_by", to: "user", requiredEvidence: true },
  { from: "defect", relation: "impacts", to: "flow", requiredEvidence: true },
  { from: "defect", relation: "linked_to", to: "release", requiredEvidence: true },
  { from: "ticket", relation: "belongs_to", to: "company", requiredEvidence: true },
  { from: "ticket", relation: "created_by", to: "user", requiredEvidence: true },
  { from: "ticket", relation: "reopened_by", to: "user", requiredEvidence: true },
  { from: "ticket", relation: "linked_to", to: "defect", requiredEvidence: true },
  { from: "test_case", relation: "belongs_to", to: "company", requiredEvidence: true },
  { from: "test_case", relation: "tested_by", to: "test_run", requiredEvidence: true },
  { from: "test_run", relation: "belongs_to", to: "company", requiredEvidence: true },
  { from: "test_run", relation: "failed_in", to: "environment", requiredEvidence: true },
  { from: "test_run", relation: "linked_to", to: "release", requiredEvidence: true },
  { from: "automation", relation: "generated_by", to: "user", requiredEvidence: true },
  { from: "automation", relation: "automated_by", to: "test_case", requiredEvidence: true },
  { from: "release", relation: "belongs_to", to: "company", requiredEvidence: true },
  { from: "release", relation: "approved_by", to: "user", requiredEvidence: true },
  { from: "module", relation: "belongs_to", to: "application", requiredEvidence: true },
  { from: "application", relation: "belongs_to", to: "company", requiredEvidence: true },
  { from: "comment", relation: "mentioned_in", to: "ticket", requiredEvidence: true },
  { from: "attachment", relation: "linked_to", to: "ticket", requiredEvidence: true },
  { from: "user", relation: "visible_to", to: "role", requiredEvidence: true },
];

export const BRIAN_ENTITY_ALIASES: Record<string, BrianNeuronKind> = {
  bug: "defect",
  defeito: "defect",
  defect: "defect",
  issue: "defect",
  chamado: "ticket",
  support: "ticket",
  suporte: "ticket",
  ticket: "ticket",
  testcase: "test_case",
  "test-case": "test_case",
  test_case: "test_case",
  case: "test_case",
  run: "test_run",
  test_run: "test_run",
  execution: "test_run",
  automacao: "automation",
  automation: "automation",
  release: "release",
  company: "company",
  empresa: "company",
  app: "application",
  application: "application",
  modulo: "module",
  module: "module",
  usuario: "user",
  user: "user",
};

export const BRIAN_IMPULSE_ALIASES: Record<string, BrianImpulseType> = {
  defect_created: "defect.created",
  defectcreated: "defect.created",
  bugcreated: "defect.created",
  bug_created: "defect.created",
  defect_updated: "defect.updated",
  defect_status_changed: "defect.status_changed",
  test_case_created: "test_case.created",
  testcase_created: "test_case.created",
  test_run_started: "test_run.started",
  test_run_failed: "test_run.failed",
  run_failed: "test_run.failed",
  automation_generated: "automation.generated",
  release_approved: "release.approved",
  release_blocked: "release.blocked",
  ticket_created: "ticket.created",
  ticket_reopened: "ticket.reopened",
  ticket_updated: "ticket.updated",
  comment_added: "comment.added",
  file_attached: "file.attached",
  permission_granted: "permission.granted",
};

export const BRIAN_ACTIVATION_POLICIES: Record<string, BrianActivationPolicy> = {
  admin: {
    profile: "admin",
    preferredNeuronTypes: [...BRIAN_NEURON_KINDS],
    minConfidence: 0.35,
    maxDepth: 4,
    recencyWindowDays: 180,
    includeArchived: true,
  },
  leader_tc: {
    profile: "leader_tc",
    preferredNeuronTypes: ["company", "module", "release", "test_run", "defect", "risk", "blocker", "automation"],
    minConfidence: 0.45,
    maxDepth: 3,
    recencyWindowDays: 90,
    includeArchived: false,
  },
  technical_support: {
    profile: "technical_support",
    preferredNeuronTypes: ["company", "module", "ticket", "defect", "environment", "user", "comment", "attachment"],
    minConfidence: 0.45,
    maxDepth: 3,
    recencyWindowDays: 60,
    includeArchived: false,
  },
  testing_company_user: {
    profile: "testing_company_user",
    preferredNeuronTypes: ["company", "module", "ticket", "defect", "test_case", "test_run", "automation"],
    minConfidence: 0.55,
    maxDepth: 2,
    recencyWindowDays: 45,
    includeArchived: false,
  },
  company_user: {
    profile: "company_user",
    preferredNeuronTypes: ["company", "module", "ticket", "defect", "release", "comment"],
    minConfidence: 0.6,
    maxDepth: 2,
    recencyWindowDays: 30,
    includeArchived: false,
  },
};

export function normalizeRegistryKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s:/-]+/g, "_").replace(/\.+/g, ".");
}

export function isBrianImpulseType(value: string): value is BrianImpulseType {
  return BRIAN_IMPULSE_TYPES.includes(value as BrianImpulseType);
}

export function isBrianNeuronKind(value: string): value is BrianNeuronKind {
  return BRIAN_NEURON_KINDS.includes(value as BrianNeuronKind);
}

export function isBrianSynapseRelation(value: string): value is BrianSynapseRelation {
  return BRIAN_SYNAPSE_RELATIONS.includes(value as BrianSynapseRelation);
}

export function resolveActivationPolicy(role?: string | null): BrianActivationPolicy {
  const key = String(role ?? "").trim().toLowerCase();
  return BRIAN_ACTIVATION_POLICIES[key] ?? BRIAN_ACTIVATION_POLICIES.company_user;
}

export function findAllowedRelation(
  from: BrianNeuronKind,
  relation: BrianSynapseRelation,
  to: BrianNeuronKind,
) {
  return BRIAN_ALLOWED_RELATIONS.find(
    (item) => item.from === from && item.relation === relation && item.to === to,
  );
}
