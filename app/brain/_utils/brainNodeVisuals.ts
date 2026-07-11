import type { IconType } from "react-icons";
import {
  FiActivity,
  FiAlertTriangle,
  FiBox,
  FiCpu,
  FiFileText,
  FiFolder,
  FiHome,
  FiLink2,
  FiMail,
  FiMessageSquare,
  FiMonitor,
  FiShield,
  FiUser,
  FiUserPlus,
} from "react-icons/fi";
import type { BrainNode } from "../_types/brain.types";

export type BrainNodeCategory =
  | "company"
  | "project"
  | "person"
  | "access_request"
  | "test_case"
  | "automation"
  | "defect"
  | "document"
  | "integration"
  | "log"
  | "permission"
  | "screen"
  | "email"
  | "comment"
  | "other";

const CATEGORY_ICON: Record<BrainNodeCategory, IconType> = {
  company: FiHome,
  project: FiFolder,
  person: FiUser,
  access_request: FiUserPlus,
  test_case: FiActivity,
  automation: FiCpu,
  defect: FiAlertTriangle,
  document: FiFileText,
  integration: FiLink2,
  log: FiActivity,
  permission: FiShield,
  screen: FiMonitor,
  email: FiMail,
  comment: FiMessageSquare,
  other: FiBox,
};

// Cor por categoria (nao por status): permite que, so de olhar o icone e a cor,
// fique obvio que tipo de coisa aquele no representa (empresa, pessoa, teste...).
const CATEGORY_ACCENT: Record<BrainNodeCategory, string> = {
  company: "37,99,235", // blue
  project: "99,102,241", // indigo
  person: "20,184,166", // teal
  access_request: "236,72,153", // pink
  test_case: "16,185,129", // emerald
  automation: "168,85,247", // purple
  defect: "239,68,68", // red
  document: "245,158,11", // amber
  integration: "139,92,246", // violet
  log: "100,116,139", // slate
  permission: "249,115,22", // orange
  screen: "14,165,233", // sky
  email: "244,63,94", // rose
  comment: "234,179,8", // yellow
  other: "148,163,184", // gray
};

export function resolveNodeCategory(node: Pick<BrainNode, "type" | "refType" | "module">): BrainNodeCategory {
  const raw = String(node.refType ?? node.type ?? "").toLowerCase();
  if (raw.includes("company")) return "company";
  if (raw.includes("project")) return "project";
  if (raw.includes("user") || raw === "person" || raw.includes("requester")) return "person";
  if (raw.includes("access_request") || raw.includes("accessrequest")) return "access_request";
  if (raw.includes("testcase") || raw.includes("test_case") || raw.includes("testplan") || raw.includes("testrun")) return "test_case";
  if (raw.includes("automation") || raw.includes("execution")) return "automation";
  if (raw.includes("defect")) return "defect";
  if (raw.includes("document") || raw.includes("pdf") || raw.includes("wiki")) return "document";
  if (raw.includes("integration")) return "integration";
  if (raw.includes("log") || raw.includes("event") || raw.includes("audit")) return "log";
  if (raw.includes("permission")) return "permission";
  if (raw.includes("screen") || raw.includes("module")) return "screen";
  if (raw.includes("email")) return "email";
  if (raw.includes("comment")) return "comment";
  return "other";
}

export function nodeCategoryIcon(node: Pick<BrainNode, "type" | "refType" | "module">): IconType {
  return CATEGORY_ICON[resolveNodeCategory(node)];
}

export function nodeCategoryAccent(node: Pick<BrainNode, "type" | "refType" | "module">): string {
  return CATEGORY_ACCENT[resolveNodeCategory(node)];
}
