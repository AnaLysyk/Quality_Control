import React, { useState, useEffect } from 'react';

interface KanbanItem {
  id: string;
  title: string;
  createdBy: string;
  empresaId: string;
}

interface KanbanColumn {
  id: string;
  name: string;
  items: KanbanItem[];
}

interface KanbanSuportesProps {
  userId: string;
  isAdmin: boolean;
  empresasVinculadas: string[];
}

const initialColumns: KanbanColumn[] = [
  { id: 'todo', name: 'A Fazer', items: [] },
  { id: 'doing', name: 'Em Progresso', items: [] },
  { id: 'done', name: 'Concluído', items: [] },
];

export default function KanbanSuportes({ userId, isAdmin, empresasVinculadas }: KanbanSuportesProps) {
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns);
  // Só dev pode movimentar chamados
  const isDev = userId?.startsWith('dev') || userId?.startsWith('it_dev');
  const kanbanUnlocked = isDev;

  // Só pode editar chamado se for o criador
  const canEdit = (item: KanbanItem) => {
    if (isAdmin && item.createdBy === userId) return true;
    if (item.createdBy === userId) return true;
    return false;
  };

  // Permissão para deletar item
  const canDelete = (item: KanbanItem) => {
    if (isAdmin) return true;
    if (item.createdBy === userId) return true;
    if (empresasVinculadas.includes(item.empresaId)) return true;
    return false;
  };

  // Deletar item
  const handleDeleteItem = (colId: string, itemId: string) => {
    setColumns(cols =>
      cols.map(col =>
        col.id === colId
          ? { ...col, items: col.items.filter(item => item.id !== itemId) }
          : col
      )
    );
  };

  // Adicionar item manualmente (exemplo)
  const handleAddItem = (colId: string) => {
    const newItem: KanbanItem = {
      id: `item-${Date.now()}`,
      title: 'Novo chamado',
      createdBy: userId,
      empresaId: empresasVinculadas[0] || 'empresa-demo',
    };
    setColumns(cols =>
      cols.map(col =>
        col.id === colId
          ? { ...col, items: [...col.items, newItem] }
          : col
      )
    );
  };

  return (
    <div className="flex gap-6 overflow-x-auto py-4">
      {kanbanUnlocked && (
        <div className="w-full text-center text-green-700 text-xs mb-2">Movimentação liberada apenas para DEV</div>
      )}
      {columns.map(col => (
        <div key={col.id} className="min-w-55 bg-white border border-gray-200 rounded-lg shadow-md p-4 flex flex-col items-center">
          <div className="font-semibold mb-2">{col.name}</div>
          <div className="flex flex-col gap-2 w-full">
            {col.items.map(item => (
              <div key={item.id} className="card-tc flex items-center justify-between px-3 py-2">
                <span>{item.title}</span>
                {canEdit(item) && (
                  <button
                    className="btn-tc ml-2 px-2 py-1 text-xs"
                    onClick={() => handleDeleteItem(col.id, item.id)}
                    title="Remover chamado"
                    disabled={!kanbanUnlocked && !isAdmin}
                  >Deletar</button>
                )}
              </div>
            ))}
          </div>
          <button className="btn-tc mt-4 w-full" onClick={() => handleAddItem(col.id)}>
            Adicionar chamado
          </button>
          {/* Exemplo: bloqueio visual para não devs */}
          {!kanbanUnlocked && (
            <div className="mt-2 text-xs text-rose-600">Apenas DEV pode mudar status dos chamados</div>
          )}
        </div>
      ))}
    </div>
  );
}
