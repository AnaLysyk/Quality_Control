"use client";

import React, { useState } from 'react';

interface Caso {
  id: string;
  nome: string;
}

interface CasoListProps {
  isAdmin: boolean;
  isDev?: boolean;
}

const initialCasos: Caso[] = [
  { id: '1', nome: 'Caso Manual 1' },
  { id: '2', nome: 'Caso Manual 2' },
];

export default function CasoList({ isAdmin, isDev }: CasoListProps) {
  const [casos, setCasos] = useState<Caso[]>(initialCasos);

  const canDelete = isAdmin || isDev;

  const handleDelete = (id: string) => {
    setCasos(casos => casos.filter(c => c.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      {casos.map(caso => (
        <div key={caso.id} className="card-tc flex items-center justify-between px-4 py-2">
          <span>{caso.nome}</span>
          {canDelete && (
            <button
              className="btn-tc px-2 py-1 text-xs"
              onClick={() => handleDelete(caso.id)}
              title="Deletar caso"
            >Deletar</button>
          )}
        </div>
      ))}
    </div>
  );
}
