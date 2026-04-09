import type { DefectHistoryEvent } from "@/lib/manualDefectHistoryStore";

export type DefectComment = {
  id: string;
  body: string;
  authorId?: string | null;
  authorName?: string | null;
  createdAt: string;
};

export type DefectAssigneeSnapshot = {
  userId: string | null;
  userName: string | null;
};

export type DefectActivitySummary = {
  assignedToUserId: string | null;
  assignedToName: string | null;
  commentsCount: number;
  lastCommentAt: string | null;
  comments: DefectComment[];
};

type AssigneePayload = {
  userId?: unknown;
  userName?: unknown;
};

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function encodeDefectAssigneeNote(input: DefectAssigneeSnapshot) {
  return JSON.stringify({
    userId: input.userId ?? null,
    userName: input.userName ?? null,
  });
}

export function decodeDefectAssigneeNote(note?: string | null): DefectAssigneeSnapshot {
  if (!note) return { userId: null, userName: null };
  try {
    const parsed = JSON.parse(note) as AssigneePayload;
    return {
      userId: normalizeString(parsed?.userId),
      userName: normalizeString(parsed?.userName),
    };
  } catch {
    return { userId: null, userName: normalizeString(note) };
  }
}

export function buildDefectComments(events: DefectHistoryEvent[]): DefectComment[] {
  return events
    .filter((event) => event.action === "comment_added" && normalizeString(event.note))
    .map((event) => ({
      id: event.id,
      body: normalizeString(event.note) ?? "",
      authorId: event.actorId ?? null,
      authorName: event.actorName ?? null,
      createdAt: event.createdAt,
    }))
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

export function summarizeDefectActivity(events: DefectHistoryEvent[]): DefectActivitySummary {
  const comments = buildDefectComments(events);
  const assigneeEvent = [...events]
    .filter((event) => event.action === "assignee_changed")
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))[0];
  const assignee = decodeDefectAssigneeNote(assigneeEvent?.note);

  return {
    assignedToUserId: assignee.userId,
    assignedToName: assignee.userName,
    commentsCount: comments.length,
    lastCommentAt: comments[0]?.createdAt ?? null,
    comments,
  };
}
