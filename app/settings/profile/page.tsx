"use client";

export default function ProfilePage() {
  const mockUser = {
    name: "Usuário",
    email: "usuario@testingmetric.com",
    role: "QA_USER",
    company: "Testing Company",
  };

  return (
    <div className="min-h-screen px-6 lg:px-10 py-10 text-[var(--tc-text-inverse,#ffffff)] bg-[var(--tc-bg,#011848)]">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--tc-accent,#ef0001)]">Configurações</p>
          <h1 className="text-3xl font-extrabold">Perfil do Usuário</h1>
          <p className="text-[var(--tc-text-secondary,#cbd5e1)]">
            Dados básicos do seu perfil. Futuramente, role e empresa serão usados para controle de acesso e vínculo a casos de teste.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--tc-border,#e5e7eb)]/30 bg-[var(--tc-surface-dark,#0f1828)] p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-[var(--tc-text-muted,#cbd5e1)]">Nome</p>
            <p className="text-lg font-semibold">{mockUser.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-[var(--tc-text-muted,#cbd5e1)]">Email</p>
            <p className="text-lg font-semibold">{mockUser.email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-[var(--tc-text-muted,#cbd5e1)]">Role</p>
            <p className="text-lg font-semibold">{mockUser.role}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-[var(--tc-text-muted,#cbd5e1)]">Empresa</p>
            <p className="text-lg font-semibold">{mockUser.company}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
