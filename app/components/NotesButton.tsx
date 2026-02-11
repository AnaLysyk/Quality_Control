"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiEdit3, FiFileText, FiTrash2, FiX, FiSave } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";

type NoteColorKey = "amber" | "sky" | "emerald" | "rose" | "violet" | "orange";

type ColorOption = {
  key: NoteColorKey;
  label: string;
  cardClass: string;
  chipClass: string;
};

const NOTE_COLORS: ColorOption[] = [
  {
    key: "amber",
    label: "Amarelo",
    cardClass: "bg-amber-100 border-amber-200 text-amber-800",
    chipClass: "bg-amber-100 border-amber-200",
  },
  {
    key: "sky",
    label: "Azul",
    cardClass: "bg-sky-100 border-sky-200 text-sky-800",
    chipClass: "bg-sky-100 border-sky-200",
  },
  {
    key: "emerald",
    label: "Verde",
    cardClass: "bg-emerald-100 border-emerald-200 text-emerald-800",
    chipClass: "bg-emerald-100 border-emerald-200",
  },
  {
    key: "rose",
    label: "Rosa",
    cardClass: "bg-rose-100 border-rose-200 text-rose-800",
    chipClass: "bg-rose-100 border-rose-200",
  },
  {
    key: "violet",
    label: "Violeta",
    cardClass: "bg-violet-100 border-violet-200 text-violet-800",
    chipClass: "bg-violet-100 border-violet-200",
  },
  {
    key: "orange",
    label: "Laranja",
    cardClass: "bg-orange-100 border-orange-200 text-orange-800",
    chipClass: "bg-orange-100 border-orange-200",
  },
];

type NoteItem = {
  id: string;
  title: string;
  content: string;
  color: NoteColorKey;
  createdAt: string;
  updatedAt: string;
};

type DraftNote = {
  title: string;
  content: string;
  color: NoteColorKey;
};

function resolveColor(key?: string | null) {
  return NOTE_COLORS.find((color) => color.key === key) ?? NOTE_COLORS[0];
}

export default function NotesButton() {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftNote | null>(null);
  const [saving, setSaving] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);

  const isCreating = editingId === "new";

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const loadNotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notes", { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: NoteItem[]; error?: string };
      if (!res.ok) {
        setNotes([]);
        setError(json?.error || "Erro ao carregar notas");
        return;
      }
      setNotes(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar notas";
      setNotes([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      loadNotes();
    }
  }, [open, loadNotes]);

  const noteCountLabel = useMemo(() => {
    if (!notes.length) return "Sem notas";
    if (notes.length === 1) return "1 nota";
    return `${notes.length} notas`;
  }, [notes.length]);

  function startCreate() {
    setMessage(null);
    setError(null);
    setEditingId("new");
    setExpandedId(null);
    setDraft({ title: "", content: "", color: NOTE_COLORS[0].key });
  }

  function startEdit(note: NoteItem) {
    setMessage(null);
    setError(null);
    setEditingId(note.id);
    setExpandedId(note.id);
    setDraft({ title: note.title, content: note.content, color: note.color });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (isCreating) {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draft),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error || "Erro ao criar nota");
          return;
        }
        setMessage("Nota criada com sucesso.");
      } else if (editingId) {
        const res = await fetch(`/api/notes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draft),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error || "Erro ao atualizar nota");
          return;
        }
        setMessage("Nota atualizada.");
      }
      setEditingId(null);
      setDraft(null);
      await loadNotes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar nota";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error || "Erro ao excluir nota");
        return;
      }
      setMessage("Nota excluida.");
      if (expandedId === noteId) setExpandedId(null);
      if (editingId === noteId) cancelEdit();
      await loadNotes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir nota";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir bloco de notas"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb)/70 bg-(--tc-surface,#ffffff) text-(--tc-text,#0f172a) shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-(--tc-accent,#ef0001)/60 hover:text-(--tc-accent,#ef0001)"
      >
        <FiEdit3 size={18} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow-[0_20px_45px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between gap-3 border-b border-(--tc-border,#e5e7eb) px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Bloco de notas</p>
              <p className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{noteCountLabel}</p>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white hover:bg-(--tc-accent-hover,#c80001)"
            >
              Criar nota
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto px-4 py-3 space-y-3">
            {isCreating && draft && (
              <div className={`rounded-xl border p-3 ${resolveColor(draft.color).cardClass}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                  Nova nota
                </p>
                <div className="mt-2 space-y-2">
                  <input
                    className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                    aria-label="Titulo da nota"
                    placeholder="Titulo"
                    value={draft.title}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  />
                  <textarea
                    rows={5}
                    className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                    aria-label="Conteudo da nota"
                    placeholder="Escreva sua nota..."
                    value={draft.content}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, content: e.target.value } : prev))}
                  />
                  <div className="flex flex-wrap gap-2">
                    {NOTE_COLORS.map((color) => (
                      <button
                        key={color.key}
                        type="button"
                        title={color.label}
                        onClick={() =>
                          setDraft((prev) => (prev ? { ...prev, color: color.key } : prev))
                        }
                        className={`h-7 w-7 rounded-full border ${color.chipClass} ${draft.color === color.key ? "ring-2 ring-(--tc-accent,#ef0001)/40" : ""}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-(--tc-surface-dark,#0b1a3c) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                  >
                    <FiSave size={14} /> {saving ? "Salvando" : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                  >
                    <FiX size={14} /> Fechar
                  </button>
                </div>
              </div>
            )}

            {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}
            {!loading && notes.length === 0 && (
              <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma nota criada ainda.</p>
            )}

            {notes.map((note) => {
              const color = resolveColor(note.color);
              const isExpanded = expandedId === note.id;
              const isEditing = editingId === note.id;
              const localDraft = isEditing && draft ? draft : null;

              return (
                <div key={note.id} className={`rounded-xl border p-3 transition ${color.cardClass}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === note.id ? null : note.id))}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{note.title || "Sem titulo"}</p>
                      <p className="text-xs opacity-70">
                        Atualizado em {new Date(note.updatedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <FiFileText className="mt-1" />
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      {isEditing && localDraft ? (
                        <>
                          <input
                            className="w-full rounded-lg border border-white/70 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                            aria-label="Titulo da nota"
                            title="Titulo da nota"
                            value={localDraft.title}
                            onChange={(e) =>
                              setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                            }
                          />
                          <textarea
                            rows={5}
                            className="w-full rounded-lg border border-white/70 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                            aria-label="Conteudo da nota"
                            title="Conteudo da nota"
                            value={localDraft.content}
                            onChange={(e) =>
                              setDraft((prev) => (prev ? { ...prev, content: e.target.value } : prev))
                            }
                          />
                          <div className="flex flex-wrap gap-2">
                            {NOTE_COLORS.map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                title={option.label}
                                onClick={() =>
                                  setDraft((prev) =>
                                    prev ? { ...prev, color: option.key } : prev
                                  )
                                }
                                className={`h-7 w-7 rounded-full border ${option.chipClass} ${localDraft.color === option.key ? "ring-2 ring-(--tc-accent,#ef0001)/40" : ""}`}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={saveDraft}
                              disabled={saving}
                              className="inline-flex items-center gap-2 rounded-lg bg-(--tc-surface-dark,#0b1a3c) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                            >
                              <FiSave size={14} /> {saving ? "Salvando" : "Salvar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNote(note.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiTrash2 size={14} /> Excluir
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiX size={14} /> Fechar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap text-slate-900/90">
                            {note.content || "Sem conteudo."}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(note)}
                              className="inline-flex items-center gap-2 rounded-lg bg-(--tc-surface-dark,#0b1a3c) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
                            >
                              <FiEdit3 size={14} /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNote(note.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiTrash2 size={14} /> Excluir
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedId(null)}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiX size={14} /> Fechar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
