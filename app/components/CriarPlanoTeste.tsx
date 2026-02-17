import React, { useState } from 'react';

interface PlanoTeste {
  id: string;
  nome: string;
}

interface CriarPlanoTesteProps {
  onPlanoCriado: (plano: PlanoTeste) => void;
}

export default function CriarPlanoTeste({ onPlanoCriado }: CriarPlanoTesteProps) {
  const [nome, setNome] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Nome obrigatório');
      return;
    }
    const novoPlano = { id: Date.now().toString(), nome };
    onPlanoCriado(novoPlano);
    setNome('');
    setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center mb-4">
      <input
        className="input-tc px-3 py-2 text-sm"
        type="text"
        value={nome}
        onChange={e => setNome(e.target.value)}
        placeholder="Nome do plano de teste"
        aria-label="Nome do plano de teste"
      />
      <button className="btn-tc px-4 py-2 text-sm" type="submit">Criar Plano</button>
      {error && <span className="text-stat-fail text-xs ml-2">{error}</span>}
    </form>
  );
}
