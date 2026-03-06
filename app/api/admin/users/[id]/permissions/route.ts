import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import jsonStore from '../../../../../../src/lib/store/jsonStore';
import { requireGlobalAdminWithStatus } from '@/lib/rbac/requireGlobalAdmin';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return NextResponse.json({ error: status === 401 ? 'Nao autenticado' : 'Sem permissao' }, { status });
  const id = params?.id;
  const overrides = jsonStore.listItems('permissionOverrides') || [];
  const entry = overrides.find((o: any) => o.userId === id) || null;
  return NextResponse.json({ item: entry });
}

export async function PATCH(req: NextRequest, { params }: { params?: { id?: string } } = { params: {} }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return NextResponse.json({ error: status === 401 ? 'Nao autenticado' : 'Sem permissao' }, { status });

  // robust id extraction: prefer params, fallback to parsing URL
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = params?.id || (parts.length >= 2 ? parts[parts.length - 2] : undefined);
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const overrides = jsonStore.listItems('permissionOverrides') || [];
  const idx = overrides.findIndex((o: any) => o.userId === id);
  const entry: any = {
    allow: body.allow || {},
    deny: body.deny || {},
    updatedAt: now,
    createdAt: idx === -1 ? now : overrides[idx].createdAt,
  };
  if (id) entry.userId = id;
  if (idx === -1) {
    overrides.push(entry);
  } else {
    overrides[idx] = entry;
  }
  jsonStore.saveList('permissionOverrides', overrides);
  return NextResponse.json({ item: entry });
}
