import { NextResponse } from 'next/server';
import { computeRiskFromInputs } from '@/app/testing-metric/types';

export async function GET() {
  // Simple aggregate from mock data - values aligned with companies mock
  const summary = {
    monitored: 5,
    inRisk: 1,
    inAttention: 2,
    releasesActive: 12,
    runsOpen: 18,
    criticals: 6,
  };

  // Example of including an explanation for the score model
  const policy = {
    passRateMinimum: 75,
    maxCriticalsPerRelease: 1,
    maxRunsOpen: 5,
    minCasesPerRelease: 10,
  };

  return NextResponse.json({ success: true, data: { summary, policy } });
}
