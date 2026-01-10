"use client";

import { useMemo, useEffect, useState } from "react";
import { FiArchive, FiAlertCircle, FiZap, FiRefreshCcw, FiShield } from "react-icons/fi";
import type { Company as CompanyType } from './types';
import DetailDrawer from './components/DetailDrawer';
import TrendLine from './components/TrendLine';

type Company = {
  id: string;
  name: string;
  logo?: string | null;
  passRate: number; // 0-100
  runsOpen: number;
  criticalDefects: number;
  releasesActive: number;
  trend: number; // positive up, negative down
  lastUpdated?: string;
};

const MOCK: Company[] = [
  { id: "GRM", name: "Griaule", passRate: 68, runsOpen: 5, criticalDefects: 2, releasesActive: 3, trend: -12 },
  { id: "SFQ", name: "Smart", passRate: 85, runsOpen: 1, criticalDefects: 0, releasesActive: 1, trend: 3 },
  { id: "PRT", name: "PrintCo", passRate: 74, runsOpen: 4, criticalDefects: 1, releasesActive: 2, trend: -6 },
  { id: "BKG", name: "BookingInc", passRate: 92, runsOpen: 0, criticalDefects: 0, releasesActive: 2, trend: 1 },
  { id: "CDS", name: "CidadeSmart", passRate: 55, runsOpen: 8, criticalDefects: 3, releasesActive: 4, trend: -18 },
];

function computeRisk(c: Company) {
  // simple implementation of proposed score
  const w1 = 0.4; // pass rate
  const w2 = 0.25; // critical defects
  const w3 = 0.15; // runs open
  const w4 = 0.15; // trend
  const w5 = 0.05; // data absence (not used here)

  const riscoPR = (100 - c.passRate) / 100; // 0..1
  const riscoFC = Math.min(1, c.criticalDefects / 5); // assume 5 criticals is full
  const riscoRA = Math.min(1, c.runsOpen / 10);
  const riscoTrend = Math.min(1, Math.max(0, -c.trend) / 20); // only negative trend contributes

  const score = (riscoPR * w1 + riscoFC * w2 + riscoRA * w3 + riscoTrend * w4 + 0 * w5) * 100;
  return Math.round(score);
}

export default function TestingMetricPage() {
  const [companies, setCompanies] = useState<CompanyType[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const base = process.env.NEXT_PUBLIC_GOVERNANCE_API_BASE || '';
    fetch(`${base}/api/governance/companies`)
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return;
        if (json?.success) setCompanies(json.data as CompanyType[]);
        else setError('Falha ao carregar empresas');
      })
      .catch(() => setError('Erro ao buscar empresas'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const enriched = useMemo(() => {
    const source = companies ?? MOCK;
    return source.map((c) => ({ ...c, riskScore: computeRisk(c as any) } as any));
  }, [companies]);

  const monitored = enriched.length;
  const inRisk = enriched.filter((c) => c.riskScore >= 60).length;
  const inAttention = enriched.filter((c) => c.riskScore >= 30 && c.riskScore < 60).length;
  const releasesActive = enriched.reduce((s, c) => s + c.releasesActive, 0);
  const runsOpen = enriched.reduce((s, c) => s + c.runsOpen, 0);
  const criticals = enriched.reduce((s, c) => s + c.criticalDefects, 0);

  const ranking = [...enriched].sort((a, b) => b.riskScore - a.riskScore);

  const [summary, setSummary] = useState<any | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_GOVERNANCE_API_BASE || '';
    fetch(`${base}/api/governance/summary`)
      .then((r) => r.json())
      .then((j) => { if (j?.success) setSummary(j.data); })
      .catch(() => {});
  }, []);

  const [aggTrend, setAggTrend] = useState<any[] | null>(null);
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_GOVERNANCE_API_BASE || '';
    fetch(`${base}/api/governance/trends`)
      .then((r) => r.json())
      .then((j) => { if (j?.success) setAggTrend(j.data); })
      .catch(() => setAggTrend(null));
  }, []);

  return (
    <div className="min-h-screen text-white px-6 py-10 md:px-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-[#f97316]">Testing Metric</p>
            <h1 className="text-3xl font-extrabold">Painel de Governança — Quality Overview</h1>
            <p className="text-sm text-gray-300">Visão executiva consolidada de qualidade multi-empresa.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition">
              <FiRefreshCcw /> Atualizar
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition">
              Exportar
            </button>
          </div>
        </header>

        {/* Top cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card label="Empresas Monitoradas" value={`${summary?.summary?.monitored ?? monitored}`} icon={<FiArchive />} color="bg-slate-700" />
          <Card label="Empresas em Risco" value={`${summary?.summary?.inRisk ?? inRisk}`} icon={<FiAlertCircle />} color="bg-red-600 pulse-slow" />
          <Card label="Empresas em Atenção" value={`${summary?.summary?.inAttention ?? inAttention}`} icon={<FiZap />} color="bg-yellow-500 pulse-soft" />
          <Card label="Releases Ativas" value={`${summary?.summary?.releasesActive ?? releasesActive}`} icon={<FiShield />} color="bg-blue-600" />
          <Card label="Runs Abertas" value={`${summary?.summary?.runsOpen ?? runsOpen}`} icon={<FiRefreshCcw />} color="bg-indigo-600" />
          <Card label="Defeitos Críticos" value={`${summary?.summary?.criticals ?? criticals}`} icon={<FiAlertCircle />} color="bg-red-700" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Map / Constellation */}
          <section className="col-span-2 rounded-2xl border border-white/10 bg-[#0f1626]/70 p-5">
            <h2 className="font-semibold text-white mb-4">Mapa de Risco por Empresa</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {enriched.map((c) => (
                <div key={c.id} onClick={() => setSelected(c.id)} className="cursor-pointer flex flex-col gap-2 rounded-xl border border-white/8 p-4 bg-white/3 hover:bg-white/5 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-sm font-bold ${c.riskScore >= 60 ? 'ring-2 ring-red-500' : c.riskScore >= 30 ? 'ring-2 ring-yellow-400' : 'ring-0'}`}>
                        {c.id}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="text-xs text-gray-400">Pass rate: {c.passRate}%</div>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className={`px-2 py-0.5 rounded-full text-[11px] text-white font-semibold ${c.riskScore >= 60 ? 'bg-red-600' : c.riskScore >= 30 ? 'bg-yellow-500' : 'bg-green-600'}`}>
                        {c.riskScore >= 60 ? 'Alto' : c.riskScore >= 30 ? 'Médio' : 'Baixo'}
                      </div>
                      <div className="text-gray-400 mt-1">{c.trend > 0 ? '↑' : c.trend < 0 ? '↓' : '→'} {Math.abs(c.trend)}%</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-300 flex items-center gap-3">
                    <div className="rounded-full border border-white/10 px-2 py-1">Runs: {c.runsOpen}</div>
                    <div className="rounded-full border border-white/10 px-2 py-1">Crit: {c.criticalDefects}</div>
                    <div className="rounded-full border border-white/10 px-2 py-1">Releases: {c.releasesActive}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-[#0f1626]/70 p-5">
            <h3 className="font-semibold text-white">Ranking de Atenção</h3>
            <ol className="mt-3 space-y-3">
              {ranking.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg p-3 bg-white/3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/8 font-bold ${r.riskScore >= 60 ? 'text-red-400' : r.riskScore >= 30 ? 'text-yellow-300' : 'text-green-300'}`}>{r.id}</div>
                    <div>
                      <div className="text-sm font-semibold">{r.name}</div>
                      <div className="text-xs text-gray-400">Pass {r.passRate}% — Runs {r.runsOpen}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${r.riskScore >= 60 ? 'text-red-400' : r.riskScore >= 30 ? 'text-yellow-300' : 'text-green-300'}`}>{r.riskScore}</div>
                    <div className="text-xs text-gray-400">score</div>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="col-span-2 rounded-2xl border border-white/10 bg-[#0f1626]/70 p-5">
            <h3 className="font-semibold text-white">Tendência de Qualidade (Pass Rate)</h3>
            <p className="text-sm text-gray-400">Evolução agregada do pass rate — linha desenhada dinamicamente.</p>
            <div className="mt-4 bg-white/3 rounded-lg p-4 h-48 flex items-center justify-center text-gray-300">
              {aggTrend ? <TrendLine points={aggTrend} /> : <div className="text-gray-400">Sem dados</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f1626]/70 p-5">
            <h3 className="font-semibold text-white">Consumo do Serviço</h3>
            <div className="mt-3 space-y-3">
              {enriched.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm text-gray-300">
                  <div>{c.name}</div>
                  <div className="text-xs text-gray-400">Execs {Math.max(1, c.releasesActive * 3)} • Def {c.criticalDefects}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f1626]/70 p-5">
          <h3 className="font-semibold text-white">Política de Qualidade</h3>
          <ul className="mt-3 text-sm text-gray-300 space-y-2">
            <li>• Pass rate mínimo: 75%</li>
            <li>• Máximo de falhas críticas aceitáveis: 1 por release</li>
            <li>• Máximo de runs abertas: 5</li>
            <li>• Mínimo de casos executados por release: 10</li>
          </ul>
        </div>
        {selected && <DetailDrawer id={selected} onClose={() => setSelected(null)} />}
      </div>
      <style jsx>{`
        .pulse-slow { animation: pulse 2.6s ease-in-out infinite; }
        .pulse-soft { animation: pulse 3.6s ease-in-out infinite; }
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(0,0,0,0); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

import AnimatedNumber from './components/AnimatedNumber';

function Card({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  const isNumber = typeof value === 'number' || (!isNaN(Number(String(value))) && String(value).trim() !== '');
  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-2 ${color} border border-white/6`} title={label}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-300">{label}</div>
        <div className="text-gray-200">{icon}</div>
      </div>
      <div className="text-2xl font-bold">
        {isNumber ? <AnimatedNumber value={Number(value)} /> : value}
      </div>
    </div>
  );
}
