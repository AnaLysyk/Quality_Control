import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listAllTickets, listTicketsForUser } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";
import { attachAssigneeInfo } from "@/lib/ticketsPresenter";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    // Futuro: filtro por query param
    // const url = new URL(req.url);
    // const status = url.searchParams.get("status");

    const allowAll = isItDev(user);
    const items = allowAll
      ? await listAllTickets()
      : await listTicketsForUser(user.id);

    // Ordena por createdAt desc (ou updatedAt se preferir)
    items.sort((a, b) => {
      if (b.createdAt && a.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return 0;
    });

    const enriched = await attachAssigneeInfo(items);

    return NextResponse.json(
      { items: enriched },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=15"
        }
      }
    );
  } catch (err) {
    console.error("Falha ao listar chamados:", err);
    return NextResponse.json(
      { error: "Falha ao listar chamados" },
      { status: 500 }
    );
  }
}
