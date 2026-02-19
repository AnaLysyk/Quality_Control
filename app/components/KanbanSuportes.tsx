import React, { useState } from 'react';

interface KanbanColumn {
  id: string;
  name: string;
}

const initialColumns: KanbanColumn[] = [
  { id: 'todo', name: 'A Fazer' },
  { id: 'doing', name: 'Em Progresso' },
  { id: 'done', name: 'Concluído' },
];

export default function KanbanSuportes() {
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns);

  // Renomear coluna
  const handleRename = (id: string, name: string) => {
    setColumns(cols => cols.map(col => col.id === id ? { ...col, name } : col));
  };

  // Remover coluna
  const handleRemove = (id: string) => {
    setColumns(cols => cols.filter(col => col.id !== id));
  };

  // Adicionar coluna
  const handleAdd = () => {
    const newId = `col-${Date.now()}`;
    setColumns(cols => [...cols, { id: newId, name: 'Nova coluna' }]);
  };

  return (
    <div className="flex gap-8 overflow-x-auto py-4">
      {columns.map(col => (
        <div key={col.id} className="min-w-85 bg-white border border-gray-200 rounded-lg shadow-md p-4 flex flex-col items-center">
          <label htmlFor={`col-name-${col.id}`} className="sr-only">Nome da coluna</label>
          <input
            id={`col-name-${col.id}`}
            className="input-tc text-center font-semibold mb-2 w-full"
            value={col.name}
            onChange={e => handleRename(col.id, e.target.value)}
            placeholder="Nome da coluna"
            title="Nome da coluna"
            aria-label="Nome da coluna"
          />
          <button
            className="btn-tc mt-2 w-full"
            onClick={() => handleRemove(col.id)}
            disabled={columns.length <= 1}
          >Remover coluna</button>
        </div>
      ))}
      <div className="min-w-85 flex flex-col items-center justify-center">
        <button className="btn-tc w-full" onClick={handleAdd}>Adicionar coluna</button>
      </div>
    </div>
  );
}
