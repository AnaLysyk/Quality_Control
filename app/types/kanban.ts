// app/types/kanban.ts

export interface KanbanItem {
  id: number | string;
  title: string;
  bug: string | null;
  dbId?: number | null; // ID da linha no Supabase (para deletar)
  link?: string | null;
  fromApi?: boolean;
}

export interface KanbanData {
  pass: KanbanItem[];
  fail: KanbanItem[];
  blocked: KanbanItem[];
  notRun: KanbanItem[];
}
