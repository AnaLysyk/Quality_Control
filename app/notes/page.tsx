import { createClient } from "@/utils/supabase/server";

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: notes } = await supabase.from("notes").select("id,title");

  return (
    <div className="min-h-screen bg-(--page-bg,#f8fafc) text-(--page-text,#0b1a3c) px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-4 rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold">Notes</h1>
        <p className="text-sm text-(--tc-text-muted,#6b7280)">
          Dados da tabela <code>notes</code> do Supabase.
        </p>
        <pre className="overflow-auto rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4 text-xs">
          {JSON.stringify(notes ?? [], null, 2)}
        </pre>
      </div>
    </div>
  );
}
