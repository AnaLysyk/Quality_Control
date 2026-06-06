import { FiLock, FiLoader } from "react-icons/fi";

type AccessDeniedStateProps = {
  state?: "denied" | "loading";
  moduleName?: string;
  requiredPermission?: string;
  title?: string;
  description?: string;
};

export default function AccessDeniedState({
  state = "denied",
  moduleName,
  requiredPermission,
  title = "Acesso negado",
  description = "Seu perfil não possui permissão para acessar esta área.",
}: AccessDeniedStateProps) {
  const loading = state === "loading";

  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-4xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-(--tc-surface-alt,#f8fafc) text-(--tc-primary,#011848)">
          {loading ? <FiLoader className="h-6 w-6 animate-spin" /> : <FiLock className="h-6 w-6" />}
        </div>
        <h1 className="mt-5 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">
          {loading ? "Validando acesso" : title}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
          {loading ? "Aguarde enquanto suas permissões são carregadas." : description}
        </p>
        {!loading && (moduleName || requiredPermission) ? (
          <dl className="mx-auto mt-5 grid max-w-xl gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3 text-left text-sm sm:grid-cols-2">
            {moduleName ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-(--tc-text-muted,#64748b)">
                  Módulo
                </dt>
                <dd className="mt-1 font-semibold text-(--tc-text-primary,#0b1a3c)">{moduleName}</dd>
              </div>
            ) : null}
            {requiredPermission ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-(--tc-text-muted,#64748b)">
                  Permissão necessária
                </dt>
                <dd className="mt-1">
                  <code className="rounded-lg bg-white px-2 py-1 text-xs text-(--tc-primary,#011848)">
                    {requiredPermission}
                  </code>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>
    </div>
  );
}
