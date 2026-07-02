function bannerCopy(status: string, accepting: boolean, requestingAdjustment: boolean) {
  if (accepting) {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-900",
      label: "Processando decisÃ£o",
      title: "Validando solicitaÃ§Ã£o...",
    };
  }

  if (requestingAdjustment) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      label: "Solicitando ajuste",
      title: "Enviando retorno ao solicitante...",
    };
  }

  if (status === "closed") {
    return {
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      label: "Fluxo encerrado",
      title: "Acesso aprovado.",
    };
  }

  if (status === "rejected") {
    return {
      tone: "border-rose-200 bg-rose-50 text-rose-900",
      label: "Fluxo encerrado",
      title: "SolicitaÃ§Ã£o recusada.",
    };
  }

  if (status === "in_progress") {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      label: "Aguardando ajuste",
      title: "Solicitante precisa revisar os dados.",
    };
  }

  return null;
}

export function OutcomeBanner({
  status,
  accepting,
  requestingAdjustment,
}: {
  status: string;
  accepting: boolean;
  requestingAdjustment: boolean;
}) {
  const copy = bannerCopy(status, accepting, requestingAdjustment);
  if (!copy) return null;

  return (
    <section className={`rounded-2xl border px-5 py-4 shadow-sm ${copy.tone}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-75">{copy.label}</p>
      <h3 className="mt-1 text-base font-black">{copy.title}</h3>
    </section>
  );
}

