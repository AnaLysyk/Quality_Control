import { NextResponse } from "next/server";

// Mock simples de planos de teste; em produção, troque pela chamada ao Qase.
export async function GET() {
  const plans = [
    {
      id: "plan-aceitacao",
      name: "Plano de Aceitacao",
      scope: "SFQ / PRINT",
      tests: 48,
      createdAt: "2025-12-20",
      risk: "medio",
      link: "https://qase.io/plan/acceptance",
    },
    {
      id: "plan-regressao",
      name: "Plano de Regressao",
      scope: "Booking / CDS",
      tests: 72,
      createdAt: "2025-12-15",
      risk: "alto",
      link: "https://qase.io/plan/regression",
    },
    {
      id: "plan-smoke",
      name: "Plano Smoke",
      scope: "GMT / Trust",
      tests: 28,
      createdAt: "2025-12-10",
      risk: "baixo",
      link: "https://qase.io/plan/smoke",
    },
  ];

  const totalTests = plans.reduce((sum, p) => sum + p.tests, 0);

  return NextResponse.json({ plans, totalTests });
}
