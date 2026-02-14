import Link from "next/link";

export default function NotFoundPage() {
  const suggestions = [
    "Verifique se o endereço digitado está correto.",
    "Confirme se você possui acesso à empresa ou módulo desejado.",
    "Caso o atalho tenha vindo de um e-mail antigo, procure a versão mais recente no painel.",
  ];

  const quickLinks = [
    { href: "/", label: "Ir para a Home" },
    { href: "/dashboard", label: "Visão geral" },
    { href: "/applications-hub", label: "Aplicações" },
    { href: "/meus-chamados", label: "Meus chamados" },
  ];

  return (
    <main className="min-h-screen bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c) flex items-center justify-center px-6 py-16">
      <section className="max-w-2xl w-full space-y-8 rounded-3xl bg-(--tc-surface,#ffffff) px-8 py-10 shadow-lg border border-(--tc-border,#e5e7eb)">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.45em] text-(--tc-accent,#ef0001)">Erro 404</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">Página não encontrada</h1>
          <p className="text-(--tc-text-secondary,#4b5563)">
            O recurso que você tentou acessar não está disponível ou foi movido. Confira as sugestões abaixo ou escolha um dos atalhos recomendados.
          </p>
        </div>

        <ul className="space-y-2 text-left text-sm text-(--tc-text-secondary,#4b5563)">
          {suggestions.map((tip) => (
            <li key={tip} className="flex gap-3 rounded-2xl bg-(--tc-surface-2,#f5f7fb) px-4 py-3">
              <span aria-hidden="true" className="mt-0.5 h-2 w-2 rounded-full bg-(--tc-accent,#ef0001)" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-3" aria-label="Atalhos rápidos">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center justify-center rounded-full border border-(--tc-border,#e5e7eb) px-5 py-2 text-sm font-semibold text-(--page-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="rounded-2xl bg-(--tc-surface-2,#f5f7fb) px-5 py-4 text-sm text-(--tc-text-secondary,#4b5563)">
          <p className="font-semibold text-(--page-text,#0b1a3c)">Ainda precisa de ajuda?</p>
          <p className="mt-1">
            Abra um chamado em <Link href="/meus-chamados" className="text-(--tc-accent,#ef0001) hover:underline">Meus chamados</Link> ou converse com o responsável pelo suporte da sua empresa.
          </p>
        </div>
      </section>
    </main>
  );
}
