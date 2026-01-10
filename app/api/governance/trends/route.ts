import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const company = url.searchParams.get('company') || 'GRM';

  // Simple mocked trend: last 8 periods
  const base = company === 'GRM' ? 75 : 85;
  const points = Array.from({ length: 8 }).map((_, i) => ({ date: new Date(Date.now() - (7 - i) * 24 * 3600 * 1000).toISOString().slice(0,10), passRate: Math.max(30, base + (i - 4) * (company === 'CDS' ? -2 : 1)) }));

  return NextResponse.json({ success: true, data: points });
}
