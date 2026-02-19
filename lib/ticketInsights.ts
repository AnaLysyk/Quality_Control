import "server-only";
import { getTicketById } from "@/lib/ticketsStore";
import { listTicketComments } from "@/lib/ticketCommentsStore";
import { listTicketEvents } from "@/lib/ticketEventsStore";

export type TicketInsights = {
  daysSinceLastUpdate: number;
  hasAssignee: boolean;
  commentCount: number;
  lastCommentFromClient: boolean;
  statusAge: number;
  riskLevel: "low" | "medium" | "high";
};

export async function getTicketInsights(ticketId: string): Promise<TicketInsights | null> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) return null;

  const now = Date.now();
  const updatedAt = new Date(ticket.updatedAt).getTime();
  const createdAt = new Date(ticket.createdAt).getTime();
  const daysSinceLastUpdate = Math.floor((now - updatedAt) / 86400000);
  const statusAge = Math.floor((now - updatedAt) / 86400000);
  const hasAssignee = !!ticket.assignedToUserId;

  const comments = await listTicketComments(ticketId);
  const commentCount = comments.length;
  let lastCommentFromClient = false;
  if (comments.length > 0) {
    const last = comments[comments.length - 1];
    lastCommentFromClient = !!last.authorUserId && !last.authorUserId.startsWith("dev");
  }

  // Simple risk logic
  let riskLevel: "low" | "medium" | "high" = "low";
  if (!hasAssignee || daysSinceLastUpdate > 3 || ticket.priority === "high") {
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
