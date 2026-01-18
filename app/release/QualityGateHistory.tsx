"use client";
import { useEffect, useState } from "react";

export function QualityGateHistory({ companySlug, releaseSlug }: { companySlug: string; releaseSlug: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    fetch(`/api/empresas/${encodeURIComponent(companySlug)}/releases/${encodeURIComponent(releaseSlug)}/gate/history`)
      .then((res) => res.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []));
  }, [open, companySlug, releaseSlug]);
  return (
    <div>
      <button data-testid="quality-gate-history" onClick={() => setOpen((v) => !v)} className="rounded border px-3 py-1 text-xs font-semibold">
        Ver histórico
      </button>
      {open && (
        <div className="mt-4 border rounded p-3 bg-white max-w-xl" data-testid="quality-gate-history-list">
          {history.length === 0 && <div className="text-xs text-gray-500">Nenhum histórico encontrado.</div>}
          <ul className="space-y-2">
            {history.map((item, i) => (
              <li key={item.id || i} data-testid="gate-history-item" className="border-b pb-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold">{item.gate_status}</span>
                  <span className="text-gray-500">{new Date(item.evaluated_at).toLocaleString()}</span>
                </div>
                <div className="text-xs text-gray-700">MTTR: {item.mttr_hours}h, Defeitos: {item.open_defects}, Fail rate: {item.fail_rate}%</div>
                {item.reasons?.length > 0 && (
                  <ul className="text-xs text-red-600 list-disc ml-4">
                    {item.reasons.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
