"use client";

import { useAuthUser, type AuthUser } from "@/hooks/useAuthUser";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hasCapability } from "@/lib/permissions";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";

export default function DashboardClient() {
  const { user, loading: userLoading } = useAuthUser();
  const router = useRouter();
  const { metrics, loading: metricsLoading } = useSystemMetrics();

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace("/login");
    }
  }, [userLoading, user, router]);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        router.push("/login");
      } else {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (userLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">Redirecionando...</div>
    );
  }

  const safeUser: Partial<AuthUser> = user ?? {};
  const capabilities = (Array.isArray(safeUser.capabilities) ? safeUser.capabilities : []) as string[];
  const isGlobalAdmin = safeUser?.isGlobalAdmin === true || safeUser?.globalRole === "global_admin";

  return (
    <div className="min-h-screen bg-(--tc-bg)">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-(--tc-text)">Dashboard</h1>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-(--tc-fail) hover:bg-(--tc-fail-hover) focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-(--tc-fail)"
            >
              Logout
            </button>
          </div>
          <div className="mt-6">
            <div className="bg-(--tc-surface) overflow-hidden shadow-(--tc-shadow-md) rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-(--tc-text)">
                  Bem-vindo, {safeUser.name}!
                </h3>
                <div className="mt-5">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-(--tc-text-muted)">Email</dt>
                      <dd className="mt-1 text-sm text-(--tc-text)">{safeUser.email}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-(--tc-text-muted)">Empresa</dt>
                      <dd className="mt-1 text-sm text-(--tc-text)">{String(safeUser.companySlug ?? 'N/A')}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-(--tc-text-muted)">Role</dt>
                      <dd className="mt-1 text-sm text-(--tc-text)">{String(safeUser.role ?? 'N/A')}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* System Metrics */}
            {isGlobalAdmin && (
              <div className="bg-(--tc-surface) overflow-hidden shadow-(--tc-shadow-md) rounded-lg mb-6">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-(--tc-text) mb-4">
                    Métricas do Sistema
                  </h3>
                  {metricsLoading ? (
                    <div className="animate-pulse">
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="bg-(--tc-surface-2) h-20 rounded"></div>
                        ))}
                      </div>
                    </div>
                  ) : metrics ? (
                    <>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
                        {/* Usuários */}
                        <div className="bg-(--tc-surface-2) overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-(--tc-icon-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-(--tc-text-muted) truncate">Usuários</dt>
                                  <dd className="text-lg font-medium text-(--tc-text)">{metrics.overview.totalUsers}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Empresas */}
                        <div className="bg-(--tc-surface-2) overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-(--tc-icon-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-(--tc-text-muted) truncate">Empresas</dt>
                                  <dd className="text-lg font-medium text-(--tc-text)">{metrics.overview.totalCompanies}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Releases */}
                        <div className="bg-(--tc-surface-2) overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-(--tc-icon-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-(--tc-text-muted) truncate">Releases</dt>
                                  <dd className="text-lg font-medium text-(--tc-text)">{metrics.overview.totalReleases}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Testes (30d) */}
                        <div className="bg-(--tc-surface-2) overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-(--tc-icon-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-(--tc-text-muted) truncate">Testes (30d)</dt>
                                  <dd className="text-lg font-medium text-(--tc-text)">{metrics.overview.totalTestRuns}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Sessões Ativas */}
                        <div className="bg-(--tc-surface-2) overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-(--tc-icon-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-(--tc-text-muted) truncate">Sessões Ativas</dt>
                                  <dd className="text-lg font-medium text-(--tc-text)">{metrics.overview.activeSessions}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Test Status Breakdown */}
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-(--tc-text) mb-3">Status dos Testes (30 dias)</h4>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-(--tc-success)">{metrics.testStats.passed}</div>
                            <div className="text-xs text-(--tc-text-muted)">Aprovados</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-(--tc-fail)">{metrics.testStats.failed}</div>
                            <div className="text-xs text-(--tc-text-muted)">Falharam</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-(--tc-warning)">{metrics.testStats.blocked}</div>
                            <div className="text-xs text-(--tc-text-muted)">Bloqueados</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-(--tc-text-muted)">{metrics.testStats.skipped}</div>
                            <div className="text-xs text-(--tc-text-muted)">Pulados</div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Dashboard Access - Always visible */}
              <div className="bg-(--tc-surface) overflow-hidden shadow-(--tc-shadow-md) rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="shrink-0">
                      <svg className="h-6 w-6 text-(--tc-icon-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-(--tc-text-muted) truncate">Dashboard</dt>
                        <dd className="text-lg font-medium text-(--tc-text)">Visão Geral</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="text-sm text-(--tc-text-secondary)">
                      Acesse métricas e estatísticas do sistema
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Panel - Only for admin+ */}
              {isGlobalAdmin && (
                <div className="bg-(--tc-surface) overflow-hidden shadow-(--tc-shadow-md) rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="shrink-0">
                        <svg className="h-6 w-6 text-(--tc-icon-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-(--tc-text-muted) truncate">Admin</dt>
                          <dd className="text-lg font-medium text-(--tc-text)">Painel Administrativo</dd>
                        </dl>
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="text-sm text-(--tc-text-secondary)">
                        Gerencie usuários, empresas e configurações
                      </div>
                      <div className="mt-3">
                        <a
                          href="/admin"
                          className="text-sm font-medium text-(--tc-accent) hover:text-(--tc-accent-hover)"
                        >
                          Acessar →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Companies - Only for admin+ */}
              {isGlobalAdmin || hasCapability(capabilities, "company:write") ? (
                <div className="bg-(--tc-surface) overflow-hidden shadow-(--tc-shadow-md) rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="shrink-0">
                        <svg className="h-6 w-6 text-(--tc-icon-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-(--tc-text-muted) truncate">Empresas</dt>
                          <dd className="text-lg font-medium text-(--tc-text)">Gestão de Empresas</dd>
                        </dl>
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="text-sm text-(--tc-text-secondary)">
                        Visualize e gerencie empresas cadastradas
                      </div>
                      <div className="mt-3">
                        <Link
                          href="/empresas"
                          className="text-sm font-medium text-(--tc-accent) hover:text-(--tc-accent-hover)"
                        >
                          Acessar →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Profile - For all users */}
              <div className="bg-(--tc-surface) overflow-hidden shadow-(--tc-shadow-md) rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="shrink-0">
                      <svg className="h-6 w-6 text-(--tc-icon-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-(--tc-text-muted) truncate">Perfil</dt>
                        <dd className="text-lg font-medium text-(--tc-text)">Minha Conta</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="text-sm text-(--tc-text-secondary)">
                      Gerencie suas informações pessoais e configurações
                    </div>
                    <div className="mt-3">
                      <a
                        href="/profile"
                        className="text-sm font-medium text-(--tc-accent) hover:text-(--tc-accent-hover)"
                      >
                        Acessar →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
