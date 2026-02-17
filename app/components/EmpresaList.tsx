import React, { useState } from 'react';

interface Empresa {
  id: string;
  nome: string;
}

interface EmpresaListProps {
  isAdmin: boolean;
  isDev?: boolean;
}

const initialEmpresas: Empresa[] = [
  { id: '1', nome: 'Testing Company' },
  { id: '2', nome: 'Empresa Demo' },
];

export default function EmpresaList({ isAdmin, isDev }: EmpresaListProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>(initialEmpresas);

  const canDelete = isAdmin || isDev;

  const handleDelete = (id: string) => {
    setEmpresas(empresas => empresas.filter(e => e.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      {empresas.map(empresa => (
        <div key={empresa.id} className="card-tc flex items-center justify-between px-4 py-2">
          <span>{empresa.nome}</span>
          {canDelete && (
            <button
              className="btn-tc px-2 py-1 text-xs"
              onClick={() => handleDelete(empresa.id)}
              title="Deletar empresa"
            >Deletar</button>
          )}
        </div>
      ))}
    </div>
  );
}
