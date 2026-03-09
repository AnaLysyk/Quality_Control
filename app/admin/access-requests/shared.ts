import {
  normalizeRequestProfileType,
  toRequestProfileTypeLabel,
  type RequestProfileTypeLabel,
} from "@/lib/requestRouting";

export type AccessTypeLabel = RequestProfileTypeLabel;

export type AccessRequestItem = {
  id: string;
  createdAt: string;
  status: string;
  email: string;
  name: string;
  fullName: string;
  jobRole: string;
  accessType: AccessTypeLabel;
  clientId: string | null;
  company: string;
  notes: string;
  rawMessage: string;
  adminNotes: string | null;
};

export type ClientOption = { id: string; name: string };
export type RawSupportRequest = {
  id: string;
  created_at: string;
  status?: string;
  email?: string;
  message?: string;
  admin_notes?: string;
};

function parseAccessType(accessType: unknown): AccessTypeLabel {
  return toRequestProfileTypeLabel(normalizeRequestProfileType(typeof accessType === "string" ? accessType : "") ?? "company_user");
}

export function parseFromMessage(message: string, email: string): Partial<AccessRequestItem> {
  const prefix = "ACCESS_REQUEST_V1 ";
  const line = message.split("\n").find((item) => item.startsWith(prefix));
  if (line) {
    try {
      const json = JSON.parse(line.slice(prefix.length)) as Record<string, unknown>;
      return {
        email: typeof json.email === "string" ? json.email : email,
        name:
          typeof json.fullName === "string"
            ? json.fullName
            : typeof json.name === "string"
              ? json.name
              : "",
        fullName:
          typeof json.fullName === "string"
            ? json.fullName
            : typeof json.name === "string"
              ? json.name
              : "",
        jobRole: typeof json.jobRole === "string" ? json.jobRole : "",
        company: typeof json.company === "string" ? json.company : "",
        clientId: typeof json.clientId === "string" ? json.clientId : null,
        accessType: parseAccessType(typeof json.profileType === "string" ? json.profileType : json.accessType),
        notes: typeof json.notes === "string" ? json.notes : "",
      };
    } catch {
      // fallthrough
    }
  }

  return { email, fullName: "", name: "" };
}
