"use client";

type ClientItem = {
  id: string;
  name: string;
  logoUrl?: string | null;
};

type Props = {
  items: ClientItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ClientList({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-600" role="status" aria-live="polite" data-testid="client-list-empty">Nenhum cliente encontrado.</p>;
  }

  return (
    <div className="space-y-2" data-testid="client-list" role="list">
      {items.map((client, idx) => {
        const isActive = client.id === selectedId;
        const initial = client.name?.trim()?.charAt(0)?.toUpperCase() || "?";
        return (
          <button
            key={client.id}
            onClick={() => onSelect(client.id)}
            className={`w-full rounded-lg border px-4 py-3 text-left flex items-center transition ${
              isActive
                ? "border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200"
                : "border-gray-200 bg-white text-gray-900 hover:border-indigo-400"
            }`}
            aria-pressed={isActive}
            aria-label={`Selecionar cliente ${client.name}`}
            tabIndex={0}
            data-testid={`client-list-item-${client.id}`}
            disabled={isActive}
          >
            <span className="flex items-center gap-3 flex-1 min-w-0">
              {client.logoUrl ? (
                <img
                  src={client.logoUrl}
                  alt={client.name + " logo"}
                  className="w-8 h-8 rounded-full border border-gray-200 object-cover bg-white shrink-0"
                  data-testid={`client-list-logo-${client.id}`}
                />
        
              ) : (
                <span
                  className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-base border border-gray-200 shrink-0"
                  aria-hidden="true"
                  data-testid={`client-list-avatar-${client.id}`}
                >
                  {initial}
                </span>
              )}
              <span className="font-semibold truncate" data-testid={`client-list-name-${client.id}`}>{client.name}</span>
            </span>
            <span className="text-xs text-gray-500 ml-2">Ver detalhes</span>
          </button>
        );
      })}
    </div>
  );
}
