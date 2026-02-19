
import "server-only";
import { getSuporteById } from "@/lib/ticketsStore";
import { listTicketComments } from "@/lib/ticketCommentsStore";

export interface TicketInsights {
  daysSinceLastUpdate: number;
  hasAssignee: boolean;
  commentCount: number;
  lastCommentFromClient: boolean;
  statusAge: number;
  riskLevel: "low" | "medium" | "high";
}

export async function getTicketInsights(ticketId: string): Promise<TicketInsights | null> {
  const suporte = await getSuporteById(ticketId);
  if (!suporte) return null;

  const now = Date.now();
  const updatedAt = new Date(suporte.updatedAt).getTime();
  const createdAt = new Date(suporte.createdAt).getTime();
  const daysSinceLastUpdate = Math.floor((now - updatedAt) / 86400000);
  const statusAge = Math.floor((now - updatedAt) / 86400000);
  const hasAssignee = !!suporte.assignedToUserId;

  const comments = await listTicketComments(suporte.id);
  const commentCount = comments.length;
  let lastCommentFromClient = false;
  if (comments.length > 0) {
    const last = comments[comments.length - 1];
    lastCommentFromClient = !!last.authorUserId && !last.authorUserId.startsWith("dev");
  }

  // Simple risk logic
  let riskLevel: "low" | "medium" | "high" = "low";
  if (!hasAssignee || daysSinceLastUpdate > 3 || suporte.priority === "high") {
    riskLevel = daysSinceLastUpdate > 7 ? "high" : "medium";
  }

  return {
    daysSinceLastUpdate,
    hasAssignee,
    commentCount,
    lastCommentFromClient,
    statusAge,
    riskLevel,
  };
}

