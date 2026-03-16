import { NextResponse } from "next/server";
import { updateApplication } from "../../../../lib/applicationsStore";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updated = await updateApplication(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: body.description !== undefined ? (body.description ?? null) : undefined,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: "application not found" }, { status: 404 });
    }

    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
