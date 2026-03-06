import { NextResponse, NextRequest } from 'next/server';
import jsonStore from '../../../../../src/lib/store/jsonStore';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const id = p.id;
  const item = jsonStore.findItem('users', id);
  if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const id = p.id;
  const patch = await req.json().catch(() => ({}));
  const updated = jsonStore.updateItem('users', id, patch);
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ item: updated });
}
