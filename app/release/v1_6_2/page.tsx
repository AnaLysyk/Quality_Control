import Kanban from "@/components/Kanban";
import StatusChart from "@/components/StatusChart";
import { getQaseRunStats, getQaseRunResults } from "@/services/qase";
import { mapQaseToKanban } from "@/utils/qaseMapper";

export default async function Page() {
  const project = "SFQ";
  const runId = 1;

  // ⭐ Infos gerais da Run (stats + título + descrição)
  const run = await getQaseRunStats(project, runId);

  const stats = {
    pass: run.stats.passed,
    fail: run.stats.failed,
    blocked: run.stats.blocked,
    notRun: run.stats.untested,
  };

  // ⭐ Casos da run (para o kanban)
  const rawResults = await getQaseRunResults(project, runId);
  const kanban = mapQaseToKanban(rawResults);

  return (
    <div className="text-white p-10">

      {/* Título */}
      <h1 className="text-4xl font-bold">{run.title}</h1>

      {/* Descrição com HTML DO QASE */}
{/* Descrição com quebra de linha REAL */}
{(() => {
  // conteúdo vindo do Qase
  const raw = run.description ?? "";

  // transforma \n em <br> sem quebrar as <span> coloridas
  const formatted = raw.replace(/\n/g, "<br>");

  return (
    <div
      className="text-gray-300 mt-4 mb-6 leading-relaxed text-sm"
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
})()}




      {/* ⭐ CARDS */}
      <div className="grid grid-cols-4 gap-4 mt-10">
        
        <div className="bg-green-600 p-6 rounded-xl text-center font-bold">
          PASS
          <div className="text-3xl mt-3">{stats.pass}</div>
        </div>

        <div className="bg-red-600 p-6 rounded-xl text-center font-bold">
          FAIL
          <div className="text-3xl mt-3">{stats.fail}</div>
        </div>

        <div className="bg-yellow-500 p-6 rounded-xl text-center font-bold text-black">
          BLOCKED
          <div className="text-3xl mt-3">{stats.blocked}</div>
        </div>

        <div className="bg-gray-600 p-6 rounded-xl text-center font-bold">
          NOT RUN
          <div className="text-3xl mt-3">{stats.notRun}</div>
        </div>
      </div>

      {/* ⭐ GRÁFICO */}
      <div className="bg-zinc-900 mt-10 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-bold mb-2">Gráfico da Release</h2>
        <StatusChart stats={stats} />
      </div>

      {/* ⭐ KANBAN */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Kanban da Execução</h2>
        <Kanban data={kanban} />
      </div>

    </div>
  );
}
