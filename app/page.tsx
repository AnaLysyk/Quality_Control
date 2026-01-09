import Link from "next/link";
import { FiGrid, FiHome, FiSettings } from "react-icons/fi";

type HomeAction = {
  title: string;
  description: string;
  href: string;
  icon: typeof FiGrid;
};

const actions: HomeAction[] = [
  {
    title: "Visao geral",
    description: "Acompanhe indicadores e a visao macro da plataforma.",
    href: "/dashboard",
    icon: FiGrid,
  },
  {
    title: "Painel Griaule",
    description: "Home dedicada ao cliente Griaule com apps e runs.",
    href: "/painel",
    icon: FiHome,
  },
  {
    title: "Configuracoes",
    description: "Perfil, tema e preferencias da sua conta.",
    href: "/settings",
    icon: FiSettings,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--page-bg,#ffffff)] text-[var(--page-text,#0b1a3c)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-10 space-y-10">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-[var(--tc-accent)]">Testing Company</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--page-text,#0b1a3c)]">Testing Metric</h1>
          <p className="text-[var(--tc-text-secondary,#4b5563)] max-w-3xl mx-auto">
            Plataforma de qualidade para multiplos clientes. Escolha o que deseja acessar.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {actions.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="card-tc rounded-2xl p-6 shadow-lg shadow-black/10 transition hover:border-[var(--tc-accent)]/60 hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] text-[var(--tc-accent)]">
                  <item.icon size={20} />
                </span>
                <h2 className="text-lg font-semibold text-[var(--page-text,#0b1a3c)]">{item.title}</h2>
              </div>
              <p className="mt-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">{item.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
