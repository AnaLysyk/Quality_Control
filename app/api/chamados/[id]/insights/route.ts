import { NextRequest } from "next/server";
import { getTicketInsights } from "@/lib/ticketInsights";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Ticket ID obrigatório" }), { status: 400 });
  }
  const insights = await getTicketInsights(id);
  if (!insights) {
    return new Response(JSON.stringify({ error: "Ticket não encontrado" }), { status: 404 });
  }
  return new Response(JSON.stringify({ insights }), { status: 200 });
}
