import { useEffect, useState } from "react";

export default function NotesPage() {
  const [notes, setNotes] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/notes")
      .then((res) => res.json())
      .then((json) => setNotes(json.notes ?? []))
      .catch(() => setError("Erro ao carregar notas"))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f8fafc) text-(--page-text,#0b1a3c) px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-4 rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold">Notes</h1>
        <p className="text-sm text-(--tc-text-muted,#6b7280)">
          Dados da tabela <code>notes</code> do Supabase (via API).
        </p>
        {loading ? (
          <div className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>
        ) : (
          <pre className="overflow-auto rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4 text-xs">
            {JSON.stringify(notes ?? [], null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
