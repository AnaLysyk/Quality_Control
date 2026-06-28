export function OutcomeBanner({
  status,
  accepting,
  requestingAdjustment,
}: {
  status: string;
  accepting: boolean;
  requestingAdjustment: boolean;
}) {
  if (accepting) {
    return (
      <section className="rounded-[24px] border border-sky-200 bg-sky-50 px-5 py-4 text-sky-900 shadow-[0_14px_34px_rgba(14,165,233,0.10)]">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Processando decisão</p>
        <h3 className="mt-1 text-lg font-black">Validando solicitação...</h3>
      </section>
    );
  }

  if (requestingAdjustment) {
    return (
      <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-[0_14px_34px_rgba(217,119,6,0.10)]">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Solicitando ajuste</p>
        <h3 className="mt-1 text-lg font-black">Enviando retorno ao solicitante...</h3>
      </section>
    );
  }

  if (status === "closed") {
    return (
      <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900 shadow-[0_14px_34px_rgba(5,150,105,0.10)]">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Pós-aprovação</p>
        <h3 className="mt-1 text-lg font-black">Acesso aprovado e fluxo encerrado</h3>
      </section>
    );
  }

  if (status === "rejected") {
    return (
      <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900 shadow-[0_14px_34px_rgba(225,29,72,0.10)]">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-700">Pós-rejeição</p>
        <h3 className="mt-1 text-lg font-black">Solicitação recusada e fluxo encerrado</h3>
      </section>
    );
  }

  if (status === "in_progress") {
    return (
      <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-[0_14px_34px_rgba(217,119,6,0.10)]">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Aguardando ajuste</p>
        <h3 className="mt-1 text-lg font-black">Solicitante precisa revisar os dados</h3>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-sky-200 bg-sky-50 px-5 py-4 text-sky-900 shadow-[0_14px_34px_rgba(14,165,233,0.10)]">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Em análise</p>
      <h3 className="mt-1 text-lg font-black">Solicitação pronta para triagem</h3>
    </section>
  );
}
