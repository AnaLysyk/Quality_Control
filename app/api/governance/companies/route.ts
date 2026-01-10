import { NextResponse } from 'next/server';
import type { Company } from '@/app/testing-metric/types';

const COMPANIES: Company[] = [
  { id: 'GRM', name: 'Griaule', logoUrl: null, passRate: 68, runsOpen: 5, criticalDefects: 2, releasesActive: 3, trendPercent: -12, qualityGate: 'attention', lastUpdated: new Date().toISOString() },
  { id: 'SFQ', name: 'Smart', logoUrl: null, passRate: 85, runsOpen: 1, criticalDefects: 0, releasesActive: 1, trendPercent: 3, qualityGate: 'approved', lastUpdated: new Date().toISOString() },
  { id: 'PRT', name: 'PrintCo', logoUrl: null, passRate: 74, runsOpen: 4, criticalDefects: 1, releasesActive: 2, trendPercent: -6, qualityGate: 'attention', lastUpdated: new Date().toISOString() },
  { id: 'BKG', name: 'BookingInc', logoUrl: null, passRate: 92, runsOpen: 0, criticalDefects: 0, releasesActive: 2, trendPercent: 1, qualityGate: 'approved', lastUpdated: new Date().toISOString() },
  { id: 'CDS', name: 'CidadeSmart', logoUrl: null, passRate: 55, runsOpen: 8, criticalDefects: 3, releasesActive: 4, trendPercent: -18, qualityGate: 'failed', lastUpdated: new Date().toISOString() },
];

export async function GET() {
  return NextResponse.json({ success: true, data: COMPANIES });
}
