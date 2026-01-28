// app/api/debug/env/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
    NODE_ENV: process.env.NODE_ENV,
    ENV_KEYS: Object.keys(process.env).filter(k => k.toLowerCase().includes('postgres') || k.toLowerCase().includes('database'))
  });
}
