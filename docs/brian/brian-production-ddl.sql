-- Brian production hardening DDL.
-- Não foi aplicado automaticamente em prisma/migrations para evitar alterar produção sem rollout aprovado.

CREATE TABLE IF NOT EXISTS brian_outbox (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  impulse_id TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  subject TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brian_outbox_status_idx ON brian_outbox(status);
CREATE INDEX IF NOT EXISTS brian_outbox_type_idx ON brian_outbox(type);
CREATE INDEX IF NOT EXISTS brian_outbox_next_attempt_idx ON brian_outbox(next_attempt_at);
CREATE INDEX IF NOT EXISTS brian_outbox_subject_idx ON brian_outbox(subject);

CREATE TABLE IF NOT EXISTS brian_dead_letter_impulses (
  id TEXT PRIMARY KEY,
  impulse_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'dead_letter',
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brian_dead_letter_status_idx ON brian_dead_letter_impulses(status);
CREATE INDEX IF NOT EXISTS brian_dead_letter_type_idx ON brian_dead_letter_impulses(type);

CREATE TABLE IF NOT EXISTS brian_context_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT,
  company_slug TEXT,
  module_key TEXT,
  route TEXT NOT NULL,
  active_neuron_ids JSONB NOT NULL DEFAULT '[]',
  active_synapse_ids JSONB NOT NULL DEFAULT '[]',
  recent_impulse_ids JSONB NOT NULL DEFAULT '[]',
  evidence_ids JSONB NOT NULL DEFAULT '[]',
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brian_context_snapshots_user_idx ON brian_context_snapshots(user_id);
CREATE INDEX IF NOT EXISTS brian_context_snapshots_company_idx ON brian_context_snapshots(company_slug);

CREATE TABLE IF NOT EXISTS brian_answer_traces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  context_snapshot_id TEXT NOT NULL,
  used_neuron_ids JSONB NOT NULL DEFAULT '[]',
  used_synapse_ids JSONB NOT NULL DEFAULT '[]',
  used_evidence_ids JSONB NOT NULL DEFAULT '[]',
  blocked_by_permission JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brian_answer_traces_user_idx ON brian_answer_traces(user_id);
CREATE INDEX IF NOT EXISTS brian_answer_traces_snapshot_idx ON brian_answer_traces(context_snapshot_id);
