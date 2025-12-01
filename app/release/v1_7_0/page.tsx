import { releasesData } from "../data";

export default function Page() {
  const data = releasesData["v1_7_0"];

  return (
    <div className="text-white p-10">
      <h1 className="text-4xl font-bold">{data.title}</h1>
      <p className="text-gray-400 mt-2">{data.summary}</p>

      <div className="grid grid-cols-4 gap-4 mt-10">
        <div className="bg-green-600 p-6 rounded-xl text-center font-bold">
          PASS
          <div className="text-3xl mt-3">{data.stats.pass}</div>
        </div>

        <div className="bg-red-600 p-6 rounded-xl text-center font-bold">
          FAIL
          <div className="text-3xl mt-3">{data.stats.fail}</div>
        </div>

        <div className="bg-yellow-500 p-6 rounded-xl text-center font-bold text-black">
          BLOCKED
          <div className="text-3xl mt-3">{data.stats.blocked}</div>
        </div>

        <div className="bg-gray-600 p-6 rounded-xl text-center font-bold">
          NOT RUN
          <div className="text-3xl mt-3">{data.stats.notRun}</div>
        </div>
      </div>

      <div className="bg-zinc-900 mt-10 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-bold mb-2">Gráfico da Release</h2>
        <p className="text-gray-500">Gráfico aparece aqui.</p>
      </div>
    </div>
  );
}
