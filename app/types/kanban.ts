// app/types/kanban.ts

export interface KanbanItem {
  id: number;
  title: string;
  bug: string | null;
  dbId?: number | null; // ID da linha no Supabase (para deletar)
}

export interface KanbanData {
  pass: KanbanItem[];
  fail: KanbanItem[];
  blocked: KanbanItem[];
  notRun: KanbanItem[];
}
