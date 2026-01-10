"use client";

import { useEffect, useState } from 'react';
import TrendLine from './TrendLine';
import type { RiskResult } from '../types';

export default function DetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [company, setCompany] = useState<any | null>(null);
  const [trend, setTrend] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    const base = process.env.NEXT_PUBLIC_GOVERNANCE_API_BASE || '';
    Promise.all([
      fetch(`${base}/api/governance/company/${id}`).then((r) => r.json()),
      fetch(`${base}/api/governance/trends?company=${id}`).then((r) => r.json()),
    ])
      .then(([c, t]) => {
        if (!mounted) return;
        if (c?.success) setCompany(c.data);
        if (t?.success) setTrend(t.data);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  if (!id) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" onClick={onClose} />
      <aside className="w-96 bg-[#0c1220] border-l border-white/6 p-4 text-white">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Detalhes — {id}</h4>
          <button onClick={onClose} className="text-gray-300">Fechar</button>
        </div>
        {loading && <div className="text-gray-400 mt-4">Carregando...</div>}
        {!loading && company && (
          <div className="mt-4 space-y-3 text-sm text-gray-300">
            <div><strong>{company.name}</strong></div>
            <div>Pass rate: {company.passRate}%</div>
            <div>Runs abertas: {company.runsOpen}</div>
            <div>Defeitos críticos: {company.criticalDefects}</div>
            <div>Releases ativas: {company.releasesActive}</div>
            <div className="mt-2">
              <h5 className="text-xs text-gray-400">Tendência</h5>
              <div className="mt-2 bg-white/3 rounded p-2"><TrendLine points={trend ?? []} /></div>
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <button
                  onClick={async () => {
                    if (!company) return;
                    setActionStatus('pending');
                    try {
                      const base = process.env.NEXT_PUBLIC_GOVERNANCE_API_BASE || '';
                      const res = await fetch(`${base}/api/governance/actions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyId: company.id, type: 'investigate', note: 'Ação criada via painel Testing Metric' }),
                      });
                      const j = await res.json();
                      if (j?.success) setActionStatus('created');
                      else setActionStatus('error');
                    } catch (e) {
                      setActionStatus('error');
                    }
                    setTimeout(() => setActionStatus(null), 2500);
                  }}
                  className="bg-red-600 px-3 py-2 rounded text-sm font-semibold"
                >
                  Criar ação
                </button>
              </div>
              {actionStatus === 'pending' && <div className="text-xs text-gray-400">Criando ação...</div>}
              {actionStatus === 'created' && <div className="text-xs text-green-400">Ação criada com sucesso.</div>}
              {actionStatus === 'error' && <div className="text-xs text-red-400">Falha ao criar ação.</div>}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
