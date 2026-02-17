import React, { useState } from 'react';

interface PlanoTeste {
  id: string;
  nome: string;
}

interface Run {
  id: string;
  nome: string;
  planoId: string;
}

interface RunListProps {
  planos: PlanoTeste[];
}

export default function RunList({ planos }: RunListProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedPlano, setSelectedPlano] = useState('');

  const handleCreateRun = () => {
    if (!selectedPlano) return;
    const plano = planos.find(p => p.id === selectedPlano);
    if (!plano) return;
    const novaRun = {
      id: Date.now().toString(),
      nome: `Run para ${plano.nome}`,
      planoId: plano.id,
    };
    setRuns(runs => [...runs, novaRun]);
  };

  return (
    <div className="flex flex-col gap-4 mt-4">
      <div className="flex gap-2 items-center">
        <select
          className="input-tc px-3 py-2 text-sm"
          value={selectedPlano}
          onChange={e => setSelectedPlano(e.target.value)}
          aria-label="Selecionar plano de teste"
        >
          <option value="">Selecione um plano</option>
          {planos.map(plano => (
            <option key={plano.id} value={plano.id}>{plano.nome}</option>
          ))}
        </select>
        <button className="btn-tc px-4 py-2 text-sm" onClick={handleCreateRun} disabled={!selectedPlano}>
          Criar Run
        </button>
      </div>
      <div>
        <h3 className="font-bold mb-2">Runs criadas</h3>
        <ul className="flex flex-col gap-2">
          {runs.map(run => (
            <li key={run.id} className="card-tc px-4 py-2">
              {run.nome} (Plano: {planos.find(p => p.id === run.planoId)?.nome || 'Desconhecido'})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
