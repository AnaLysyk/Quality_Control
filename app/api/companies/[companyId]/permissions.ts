import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getPermissionsPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "permissions.json");
}

async function readPermissions(companyId: string) {
  try {
    const data = await fs.readFile(getPermissionsPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writePermissions(companyId: string, permissions: any) {
  await fs.mkdir(path.dirname(getPermissionsPath(companyId)), { recursive: true });
  await fs.writeFile(getPermissionsPath(companyId), JSON.stringify(permissions, null, 2));
}

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const permissions = await readPermissions(companyId);
  return NextResponse.json(permissions);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.userId || !body.roles) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const permissions = await readPermissions(companyId);
  permissions[body.userId] = body.roles;
  await writePermissions(companyId, permissions);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const permissions = await readPermissions(companyId);
  if (!permissions[body.userId]) return NextResponse.json({ error: "Usuário não possui permissões" }, { status: 404 });
  permissions[body.userId] = body.roles;
  await writePermissions(companyId, permissions);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const permissions = await readPermissions(companyId);
  if (!permissions[body.userId]) return NextResponse.json({ error: "Usuário não possui permissões" }, { status: 404 });
  delete permissions[body.userId];
  await writePermissions(companyId, permissions);
  return NextResponse.json({ ok: true });
}
