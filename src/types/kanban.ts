export type KanbanItem = {
  id: string | number;
  title?: string;
  bug?: string | null;
  dbId?: number | null;
  link?: string | null;
  fromApi?: boolean;
};

export type KanbanData = {
  pass: KanbanItem[];
  fail: KanbanItem[];
  blocked: KanbanItem[];
  notRun: KanbanItem[];
};
