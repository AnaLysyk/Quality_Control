import { NextResponse } from 'next/server';
import jsonStore from '../../../../src/lib/store/jsonStore';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const item = jsonStore.findItem('users', id);
  if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const patch = await req.json().catch(() => ({}));
  const updated = jsonStore.updateItem('users', id, patch);
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ item: updated });
}
