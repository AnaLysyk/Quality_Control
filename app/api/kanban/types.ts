export type Status = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";

export type Card = {
  id: number;
  project: string;
  client_slug: string;
  run_id: number;
  case_id: number | null;
  title: string;
  status: Status;
  bug?: string | null;
  link?: string | null;
  created_at: string;
};
