import { createClient } from "@/utils/supabase/server";

export default async function NotesPage() {
  const hasSupabaseConfig =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl rounded-2xl border border-dashed border-[#e5e7eb] bg-white/80 p-8 text-center text-sm text-[#4b5563] shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0f172a] mb-2">Configuração pendente</h1>
          <p className="leading-relaxed">
            Configure as variáveis <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (ex.: via <strong>vercel env pull</strong>) para
            acessar a tabela <code>notes</code>.
          </p>
        </div>
      </div>
    );
  }

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
