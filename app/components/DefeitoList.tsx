import React, { useState } from 'react';

interface Defeito {
  id: string;
  nome: string;
}

interface DefeitoListProps {
  isAdmin: boolean;
  isDev?: boolean;
}

const initialDefeitos: Defeito[] = [
  { id: '1', nome: 'Defeito Manual 1' },
  { id: '2', nome: 'Defeito Manual 2' },
];

export default function DefeitoList({ isAdmin, isDev }: DefeitoListProps) {
  const [defeitos, setDefeitos] = useState<Defeito[]>(initialDefeitos);

  const canDelete = isAdmin || isDev;

  const handleDelete = (id: string) => {
    setDefeitos(defeitos => defeitos.filter(d => d.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      {defeitos.map(defeito => (
        <div key={defeito.id} className="card-tc flex items-center justify-between px-4 py-2">
          <span>{defeito.nome}</span>
          {canDelete && (
            <button
              className="btn-tc px-2 py-1 text-xs"
              onClick={() => handleDelete(defeito.id)}
              title="Deletar defeito"
            >Deletar</button>
          )}
        </div>
      ))}
    </div>
  );
}
