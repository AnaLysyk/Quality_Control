export type Status = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";

export type Card = {
  id: number;
  project: string;
  run_id?: number;
  case_id?: number | null;
  title?: string | null;
  status?: Status | null;
  bug?: string | null;
  link?: string | null;
  created_at?: string | null;
};
