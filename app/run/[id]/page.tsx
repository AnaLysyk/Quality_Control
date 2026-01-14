import StatusChart from "@/components/StatusChart";
import StatCard from "@/components/StatCard";
import { fetchApi } from "@/lib/api";

type Stats = { pass: number; fail: number; blocked: number; notRun: number };

const PROJECT =
  process.env.NEXT_PUBLIC_QASE_DEFAULT_PROJECT ||
  process.env.NEXT_PUBLIC_QASE_PROJECT ||
  "SFQ";

async function fetchRun(id: string) {
  try {
    const res = await fetchApi(`/api/v1/run/${id}?project=${PROJECT}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

type RawRunStats = {
  status_counts?: Record<string, unknown>;
  statuses?: Record<string, unknown>;
  passed?: unknown;
  failed?: unknown;
  blocked?: unknown;
  skipped?: unknown;
  untested?: unknown;
};

function normalizeStats(raw: RawRunStats): Stats {
  const statuses = raw?.status_counts ?? raw?.statuses ?? {};
  const toNumber = (val: unknown) => {
    const n = Number(val ?? 0);
    return Number.isNaN(n) ? 0 : n;
  };
  const pass = toNumber(raw?.passed ?? statuses?.passed);
  const fail = toNumber(raw?.failed ?? statuses?.failed);
  const blocked = toNumber(raw?.blocked ?? statuses?.blocked);
  const skipped = toNumber(raw?.skipped ?? statuses?.skipped);
  const untested = toNumber(raw?.untested ?? statuses?.untested);
  return {
    pass,
    fail,
    blocked,
    notRun: skipped + untested,
  };
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await fetchRun(id);

  if (!run) {
    return (
      <div className="min-h-screen tc-dark flex items-center justify-center text-(--tc-text-inverse) bg-(--tc-bg) px-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Run nao encontrada</h1>
          <p className="text-sm text-(--tc-text-secondary)">ID: {id}</p>
        </div>
      </div>
    );
  }

  const stats = normalizeStats(run?.stats);
  const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
  const pct = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const created = run?.created || run?.created_at || run?.start_time || null;
  const formattedCreated = created ? new Date(created).toLocaleString("pt-BR") : "Data N/D";

  return (
    <div className="min-h-screen tc-dark text-(--tc-text-inverse) bg-(--tc-bg) px-6 md:px-10 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent)">Run</p>
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">{run.title ?? `Run ${run.id}`}</h1>
          <p className="text-sm text-(--tc-text-muted)">
            ID: {run.id} {run.status_text ? `| Status: ${run.status_text}` : ""} | Criada em: {formattedCreated}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-tc bg-(--tc-surface-dark) border-(--tc-border)/20 p-6">
            <StatusChart stats={stats} />
          </div>
          <div className="card-tc bg-(--tc-surface-dark) border-(--tc-border)/20 p-6 space-y-3">
            <h2 className="text-xl font-bold">Resumo</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <StatCard label="Pass" value={stats.pass} percent={pct(stats.pass)} tone="pass" />
              <StatCard label="Fail" value={stats.fail} percent={pct(stats.fail)} tone="fail" />
              <StatCard label="Blocked" value={stats.blocked} percent={pct(stats.blocked)} tone="blocked" />
              <StatCard label="Not Run" value={stats.notRun} percent={pct(stats.notRun)} tone="notRun" />
              <StatCard label="Total" value={total} tone="inverse" className="col-span-2" />
            </div>
            {run.description && (
              <div className="rounded-lg bg-white/5 border border-(--tc-border)/20 px-3 py-2 text-sm text-(--tc-text-inverse)">
                <p className="text-(--tc-text-muted) text-xs mb-1">Descricao</p>
                <p className="whitespace-pre-wrap leading-relaxed">{run.description}</p>
              </div>
            )}
            <a
              href={`https://app.qase.io/run/${PROJECT}/${run.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-(--tc-accent) px-4 py-2 text-sm font-semibold text-(--tc-accent) hover:bg-(--tc-accent-soft) transition"
            >
              Abrir no Qase
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
