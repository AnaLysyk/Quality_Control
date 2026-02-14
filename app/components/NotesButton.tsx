"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiEdit3, FiFileText, FiTrash2, FiX, FiSave } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";

type NoteColorKey = "amber" | "sky" | "emerald" | "rose" | "violet" | "orange";

type ColorOption = {
  key: NoteColorKey;
  label: string;
  bg: string;
  border: string;
  text: string;
};

const NOTE_COLORS: ColorOption[] = [
  { key: "amber", label: "Amarelo", bg: "var(--note-amber-bg)", border: "var(--note-amber-border)", text: "var(--note-amber-text)" },
  { key: "sky", label: "Azul", bg: "var(--note-sky-bg)", border: "var(--note-sky-border)", text: "var(--note-sky-text)" },
  { key: "emerald", label: "Verde", bg: "var(--note-emerald-bg)", border: "var(--note-emerald-border)", text: "var(--note-emerald-text)" },
  { key: "rose", label: "Rosa", bg: "var(--note-rose-bg)", border: "var(--note-rose-border)", text: "var(--note-rose-text)" },
  { key: "violet", label: "Violeta", bg: "var(--note-violet-bg)", border: "var(--note-violet-border)", text: "var(--note-violet-text)" },
  { key: "orange", label: "Laranja", bg: "var(--note-orange-bg)", border: "var(--note-orange-border)", text: "var(--note-orange-text)" },
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

// resolveColor removed; note color is applied via note.color where needed

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
  const storageKey = user ? `qc:user_notes:${user.id}` : null;

  const readLocalNotes = useCallback((): NoteItem[] => {
    if (!storageKey || typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(Boolean) as NoteItem[];
    } catch {
      return [];
    }
  }, [storageKey]);

  const writeLocalNotes = useCallback(
    (items: NoteItem[]) => {
      if (!storageKey || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(items));
      } catch {
        // ignore localStorage errors
      }
    },
    [storageKey],
  );

  const mergeNotes = useCallback((serverItems: NoteItem[], localItems: NoteItem[]) => {
    const map = new Map<string, NoteItem>();
    serverItems.forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    localItems.forEach((item) => {
      if (item?.id && !map.has(item.id)) map.set(item.id, item);
    });
    return Array.from(map.values()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, []);

  const upsertLocalNote = useCallback(
    (note: NoteItem) => {
      const current = readLocalNotes();
      const next = [note, ...current.filter((item) => item.id !== note.id)];
      writeLocalNotes(next);
      setNotes(next);
    },
    [readLocalNotes, writeLocalNotes],
  );

  const removeLocalNote = useCallback(
    (noteId: string) => {
      const current = readLocalNotes();
      const next = current.filter((item) => item.id !== noteId);
      writeLocalNotes(next);
      setNotes(next);
    },
    [readLocalNotes, writeLocalNotes],
  );

  useEffect(() => {
    // Reset notes when user changes
    setNotes([]);
    setError(null);
    setMessage(null);
    setEditingId(null);
    setExpandedId(null);
    setDraft(null);
  }, [storageKey]);

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
    const localItems = readLocalNotes();
    if (localItems.length) {
      setNotes(localItems);
    }
    try {
      const res = await fetch("/api/notes", { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: NoteItem[]; error?: string };
      if (!res.ok) {
        if (!localItems.length) {
          setNotes([]);
        }
        setError(json?.error || "Erro ao carregar notas");
        return;
      }
      const serverItems = Array.isArray(json.items) ? json.items : [];
      const merged = mergeNotes(serverItems, localItems);
      setNotes(merged);
      writeLocalNotes(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar notas";
      if (!localItems.length) {
        setNotes([]);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, readLocalNotes, writeLocalNotes, mergeNotes]);

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
        if (json?.item) {
          upsertLocalNote(json.item as NoteItem);
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
        if (json?.item) {
          upsertLocalNote(json.item as NoteItem);
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
      removeLocalNote(noteId);
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
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[--tc-border]/70 bg-[--tc-surface] text-[--tc-text] shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-[--tc-accent]/60 hover:text-[--tc-accent]"
      >
        <FiEdit3 size={18} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[--tc-border] bg-[--tc-surface] shadow-[0_20px_45px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between gap-3 border-b border-[--tc-border] px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[--tc-text-muted]">Bloco de notas</p>
              <p className="text-sm font-semibold text-[--tc-text-primary]">{noteCountLabel}</p>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg bg-[--tc-accent] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white hover:bg-[--tc-accent-hover]"
            >
              Criar nota
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto px-4 py-3 space-y-3">
            {isCreating && draft && (
              <div className={`rounded-xl border p-3 note-color-${draft.color}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                  Nova nota
                </p>
                <div className="mt-2 space-y-2">
                  <input
                    className="form-control-user w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                    placeholder="Titulo"
                    value={draft.title}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  />
                  <textarea
                    rows={5}
                    className="form-control-user w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
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
                        className={`h-7 w-7 rounded-full border note-swatch-${color.key} ${draft.color === color.key ? "ring-2 ring-(--tc-accent,#ef0001)/40" : ""}`}
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

            {loading && <p className="text-sm text-[--tc-text-muted]">Carregando...</p>}
            {!loading && notes.length === 0 && (
              <p className="text-sm text-[--tc-text-muted]">Nenhuma nota criada ainda.</p>
            )}

            {notes.map((note) => {
              const isExpanded = expandedId === note.id;
              const isEditing = editingId === note.id;
              const localDraft = isEditing && draft ? draft : null;

              return (
                <div key={note.id} className={`rounded-xl border p-3 transition note-color-${note.color}`}>
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
                            className="form-control-user w-full rounded-lg border border-[--tc-border] bg-[--tc-surface] px-3 py-2 text-sm text-[--tc-text] focus:outline-none focus:ring-2 focus:ring-[--tc-accent]/30"
                            placeholder="Titulo"
                            aria-label="Editar titulo da nota"
                            value={localDraft.title}
                            onChange={(e) =>
                              setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                            }
                          />
                          <textarea
                            rows={5}
                            className="form-control-user w-full rounded-lg border border-[--tc-border] bg-[--tc-surface] px-3 py-2 text-sm text-[--tc-text] focus:outline-none focus:ring-2 focus:ring-[--tc-accent]/30"
                            placeholder="Escreva sua nota..."
                            aria-label="Editar conteudo da nota"
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
                                className={`h-7 w-7 rounded-full border note-swatch-${option.key} ${localDraft.color === option.key ? "ring-2 ring-[--tc-accent]/40" : ""}`}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={saveDraft}
                              disabled={saving}
                              className="inline-flex items-center gap-2 rounded-lg bg-[--tc-surface-dark] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                            >
                              <FiSave size={14} /> {saving ? "Salvando" : "Salvar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNote(note.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-[--tc-border] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiTrash2 size={14} /> Excluir
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-2 rounded-lg border border-[--tc-border] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiX size={14} /> Fechar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap text-[--tc-text]">
                            {note.content || "Sem conteudo."}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(note)}
                              className="inline-flex items-center gap-2 rounded-lg bg-[--tc-surface-dark] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
                            >
                              <FiEdit3 size={14} /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNote(note.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-[--tc-border] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiTrash2 size={14} /> Excluir
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedId(null)}
                              className="inline-flex items-center gap-2 rounded-lg border border-[--tc-border] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
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

            {error && <p className="text-sm text-[--tc-accent]">{error}</p>}
            {message && <p className="text-sm text-[--success]">{message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
