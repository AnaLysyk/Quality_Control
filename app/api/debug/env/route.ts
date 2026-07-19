// app/api/debug/env/route.ts
import { NextResponse } from 'next/server';
import { getAccessContext } from '@/backend/auth/session';

export async function GET(req: Request) {
  const access = await getAccessContext(req);
  if (!access) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!access.isGlobalAdmin && access.projectScope !== 'unrestricted') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  return NextResponse.json({
    DATABASE_URL_CONFIGURED: Boolean(process.env.DATABASE_URL),
    POSTGRES_PRISMA_URL_CONFIGURED: Boolean(process.env.POSTGRES_PRISMA_URL),
    NODE_ENV: process.env.NODE_ENV,
  }, { headers: { 'cache-control': 'no-store' } });
}
