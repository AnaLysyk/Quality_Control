"use client";

type ClientItem = {
  id: string;
  name: string;
};

type Props = {
  items: ClientItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ClientList({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-600">Nenhum cliente encontrado.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((client) => {
        const isActive = client.id === selectedId;
        return (
          <button
            key={client.id}
            onClick={() => onSelect(client.id)}
            className={`w-full rounded-lg border px-4 py-3 text-left transition ${
              isActive
                ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                : "border-gray-200 bg-white text-gray-900 hover:border-indigo-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{client.name}</span>
              <span className="text-xs text-gray-500">Ver detalhes</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
