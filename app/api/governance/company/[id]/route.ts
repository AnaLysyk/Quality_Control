import { NextRequest, NextResponse } from "next/server";

type GovernanceCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  passRate: number;
  runsOpen: number;
  criticalDefects: number;
  releasesActive: number;
  trendPercent: number;
  qualityGate: "approved" | "attention" | "failed";
  lastUpdated: string;
};

const COMP_MAP: Record<string, GovernanceCompany> = {
  GRM: {
    id: "GRM",
    name: "Griaule",
    logoUrl: null,
    passRate: 68,
    runsOpen: 5,
    criticalDefects: 2,
    releasesActive: 3,
    trendPercent: -12,
    qualityGate: "attention",
    lastUpdated: new Date().toISOString(),
  },
  SFQ: {
    id: "SFQ",
    name: "Smart",
    logoUrl: null,
    passRate: 85,
    runsOpen: 1,
    criticalDefects: 0,
    releasesActive: 1,
    trendPercent: 3,
    qualityGate: "approved",
    lastUpdated: new Date().toISOString(),
  },
  PRT: {
    id: "PRT",
    name: "PrintCo",
    logoUrl: null,
    passRate: 74,
    runsOpen: 4,
    criticalDefects: 1,
    releasesActive: 2,
    trendPercent: -6,
    qualityGate: "attention",
    lastUpdated: new Date().toISOString(),
  },
  BKG: {
    id: "BKG",
    name: "BookingInc",
    logoUrl: null,
    passRate: 92,
    runsOpen: 0,
    criticalDefects: 0,
    releasesActive: 2,
    trendPercent: 1,
    qualityGate: "approved",
    lastUpdated: new Date().toISOString(),
  },
  CDS: {
    id: "CDS",
    name: "CidadeSmart",
    logoUrl: null,
    passRate: 55,
    runsOpen: 8,
    criticalDefects: 3,
    releasesActive: 4,
    trendPercent: -18,
    qualityGate: "failed",
    lastUpdated: new Date().toISOString(),
  },
};

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response>;
export async function GET(_request: Request, context: { params: { id: string } }): Promise<Response>;
export async function GET(
  _request: NextRequest | Request,
  context: { params: Promise<{ id: string }> } | { params: { id: string } }
): Promise<Response> {
  const resolvedParams = await Promise.resolve((context as { params: unknown }).params) as { id: string };
  const { id } = resolvedParams;
  const key = (id ?? "").toString().trim().toUpperCase();
  const company = COMP_MAP[key];

  if (!company) {
    return NextResponse.json(
      { success: false, error: { message: "Company not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: company });
}
