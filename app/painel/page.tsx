import Link from "next/link";

export default function PainelHome() {
  return (
    <div className="min-h-screen griaule-wall text-white p-10 space-y-10 font-['Segoe_UI','Helvetica','Arial',sans-serif]">

      {/* TÍTULO PRINCIPAL */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-wide">PAINEL QA</h1>
        <p className="text-gray-300 text-sm">
          Central de controle dos testes, execuções e releases do projeto SMART.
        </p>
      </div>

      {/* CARDS PRINCIPAIS */}
      <div className="grid gap-6 md:grid-cols-3 w-full max-w-6xl mx-auto">

        {/* SMART RELEASES */}
        <Link href="/applications/smart" className="no-underline">
          <div className="rounded-xl border border-[#2f3b4d] bg-[#1b2435] p-6 shadow-lg hover:-translate-y-1 hover:border-[#7CD343]/70 transition cursor-pointer">
            <h2 className="text-xl font-semibold">Releases SMART</h2>
            <p className="text-gray-300 mt-2 text-sm">
              Acompanhe gráficos, execuções e progresso das versões.
            </p>
            <p className="text-[#7CD343] font-semibold mt-4">Abrir →</p>
          </div>
        </Link>

        {/* KANBAN */}
        <Link href="/kanban" className="no-underline">
          <div className="rounded-xl border border-[#2f3b4d] bg-[#1b2435] p-6 shadow-lg hover:-translate-y-1 hover:border-blue-400/70 transition cursor-pointer">
            <h2 className="text-xl font-semibold">Kanban Geral</h2>
            <p className="text-gray-300 mt-2 text-sm">
              Status consolidado: PASS, FAIL, BLOCKED e NOT RUN.
            </p>
            <p className="text-blue-400 font-semibold mt-4">Abrir →</p>
          </div>
        </Link>

        {/* EXECUÇÕES RECENTES */}
        <Link href="/execucoes" className="no-underline">
          <div className="rounded-xl border border-[#2f3b4d] bg-[#1b2435] p-6 shadow-lg hover:-translate-y-1 hover:border-purple-400/70 transition cursor-pointer">
            <h2 className="text-xl font-semibold">Execuções Recentes</h2>
            <p className="text-gray-300 mt-2 text-sm">
              Histórico das últimas runs e desempenho geral.
            </p>
            <p className="text-purple-400 font-semibold mt-4">Abrir →</p>
          </div>
        </Link>
      </div>

      {/* ACESSO RÁPIDO */}
      <div className="w-full max-w-4xl mx-auto mt-12">
        <h3 className="text-xl font-bold mb-4">Acesso rápido</h3>

        <div className="grid md:grid-cols-4 sm:grid-cols-2 gap-4">
          <a
            href="https://app.qase.io"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[#1f2b3f] p-4 border border-[#2f3b4d] text-center hover:border-[#7CD343] transition"
          >
            Qase
          </a>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[#1f2b3f] p-4 border border-[#2f3b4d] text-center hover:border-[#7CD343] transition"
          >
            Repositório
          </a>

          <a
            href="#"
            className="rounded-lg bg-[#1f2b3f] p-4 border border-[#2f3b4d] text-center hover:border-[#7CD343] transition"
          >
            Ambientes
          </a>

          <a
            href="#"
            className="rounded-lg bg-[#1f2b3f] p-4 border border-[#2f3b4d] text-center hover:border-[#7CD343] transition"
          >
            Documentação
          </a>
        </div>
      </div>
    </div>
  );
}
