// app/types/kanban.ts

export interface KanbanItem {
  id: number;
  title: string;
  bug: string | null;
}

export interface KanbanData {
  pass: KanbanItem[];
  fail: KanbanItem[];
  blocked: KanbanItem[];
  notRun: KanbanItem[];
}
