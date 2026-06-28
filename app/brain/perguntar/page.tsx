"use client";

import Link from "next/link";
import { useEffect } from "react";

const brainAssistantContext = {
  route: "/brain/perguntar",
  module: "brain",
  screenLabel: "Brain Assistente",
  screenSummary: [
    "Voce esta em: Brain Assistente.",
    "Aqui voce conversa com agentes especializados sobre o grafo de conhecimento e a plataforma Quality Control.",
    "Como agente, posso explicar relacoes, buscar contexto permitido pelo seu RBAC e sugerir proximas acoes.",
  ].join(" "),
  entityType: "screen",
  suggestedPrompts: [
    "Explicar o que posso fazer no Brain",
    "Buscar contexto no Brain",
    "Resumir o grafo de conhecimento",
    "Sugerir proxima acao como agente",
  ],
} as const;

function openBrainAssistant(initialMessage?: string) {
  window.dispatchEvent(
    new CustomEvent("assistant:open", {
      detail: {
        source: "brain",
        route: "/brain/perguntar",
        panelMode: "side",
        agentMode: "qa",
        focusInput: true,
        initialMessage,
        context: brainAssistantContext,
        metadata: {
          entrypoint: "brain-ask",
        },
      },
    }),
  );
}

export default function BrainPerguntarPage() {
  useEffect(() => {
    const timers = [120, 450, 900].map((delay) =>
      window.setTimeout(() => openBrainAssistant(), delay),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-[radial-gradient(circle_at_18%_18%,rgba(239,0,1,0.08),transparent_28%),linear-gradient(135deg,#f8fbff_0%,#ffffff_46%,#fff7f8_100%)] px-6 py-12 text-[#011848] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(239,0,1,0.14),transparent_30%),linear-gradient(135deg,#081224_0%,#101d32_48%,#1c1017_100%)] dark:text-[#f2f7ff]">
      <section className="mx-auto flex max-w-4xl flex-col gap-8 rounded-[2rem] border border-[#dfe6f3] bg-white/88 p-8 shadow-[0_28px_80px_rgba(1,24,72,0.12)] backdrop-blur dark:border-[#31476f] dark:bg-[#101b30]/88">
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#ef0001] dark:text-[#ff9a9a]">
            Brain Assistente
          </p>
          <h1 className="max-w-2xl text-4xl font-black tracking-[-0.05em] text-[#011848] dark:text-white">
            O Brain esta pronto para conversar.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[#4a5a78] dark:text-[#b6c6e2]">
            O painel lateral deve abrir automaticamente. Se nao abrir, use o botao abaixo para chamar o assistente com o contexto correto.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openBrainAssistant()}
            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#011848_0%,#1f4aa3_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_32px_rgba(1,24,72,0.22)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#ef0001_0%,#c70000_100%)]"
          >
            Abrir assistente lateral
          </button>
          <button
            type="button"
            onClick={() => openBrainAssistant("Explique o que posso fazer no Brain e quais acoes estao disponiveis para meu perfil.")}
            className="inline-flex items-center justify-center rounded-full border border-[#d7dff1] bg-white px-5 py-3 text-sm font-bold text-[#011848] transition hover:border-[rgba(239,0,1,0.28)] hover:text-[#ef0001] dark:border-[#36507f] dark:bg-[#13213a] dark:text-[#d7e5ff] dark:hover:text-[#ff9a9a]"
          >
            Explicar meu acesso
          </button>
          <Link
            href="/brain"
            className="inline-flex items-center justify-center rounded-full border border-[#d7dff1] bg-white px-5 py-3 text-sm font-bold text-[#011848] transition hover:border-[rgba(239,0,1,0.28)] hover:text-[#ef0001] dark:border-[#36507f] dark:bg-[#13213a] dark:text-[#d7e5ff] dark:hover:text-[#ff9a9a]"
          >
            Ver grafo do Brain
          </Link>
        </div>
      </section>
    </main>
  );
}
