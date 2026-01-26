"use client";

import { useAuthUser } from "@/hooks/useAuthUser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hasPermission, getUserRoleFromSession } from "@/lib/permissions";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";

export default function DashboardClient() {
  const { user, loading: userLoading } = useAuthUser();
  const router = useRouter();
  const { metrics, loading: metricsLoading } = useSystemMetrics();

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

  // Permitir renderização em modo mock
  if (!user) {
    // Dados de usuário mock
    const mockUser = {
      userId: "mock-admin-griaule",
      email: "admin@example.com",
      name: "Mock Admin",
      companyId: "mock-company-griaule",
      companySlug: "griaule",
      role: "admin",
    };
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="mb-4">Modo mock: usuário de teste</div>
        <div>Email: {mockUser.email}</div>
        <div>Nome: {mockUser.name}</div>
        <div>Empresa: {mockUser.companySlug}</div>
        <div>Role: {mockUser.role}</div>
      </div>
    );
  }

  const safeUser = user as any;
  const userRole = getUserRoleFromSession({ role: safeUser.role });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Logout
            </button>
          </div>
          <div className="mt-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Bem-vindo, {safeUser.name}!
                </h3>
                <div className="mt-5">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Email</dt>
                      <dd className="mt-1 text-sm text-gray-900">{safeUser.email}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Empresa</dt>
                      <dd className="mt-1 text-sm text-gray-900">{safeUser.companySlug || 'N/A'}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Role</dt>
                      <dd className="mt-1 text-sm text-gray-900">{safeUser.role || 'N/A'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* System Metrics */}
            {hasPermission(userRole, 'view_admin') && (
              <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Métricas do Sistema
                  </h3>

                  {metricsLoading ? (
                    <div className="animate-pulse">
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="bg-gray-200 h-20 rounded"></div>
                        ))}
                      </div>
                    </div>
                  ) : metrics ? (
                    <>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="bg-gray-50 overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-gray-500 truncate">Usuários</dt>
                                  <dd className="text-lg font-medium text-gray-900">{metrics.overview.totalUsers}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-gray-500 truncate">Empresas</dt>
                                  <dd className="text-lg font-medium text-gray-900">{metrics.overview.totalCompanies}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-gray-500 truncate">Releases</dt>
                                  <dd className="text-lg font-medium text-gray-900">{metrics.overview.totalReleases}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-gray-500 truncate">Testes (30d)</dt>
                                  <dd className="text-lg font-medium text-gray-900">{metrics.overview.totalTestRuns}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 overflow-hidden rounded-lg">
                          <div className="p-5">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                              </div>
                              <div className="ml-5 w-0 flex-1">
                                <dl>
                                  <dt className="text-sm font-medium text-gray-500 truncate">Sessões Ativas</dt>
                                  <dd className="text-lg font-medium text-gray-900">{metrics.overview.activeSessions}</dd>
                                </dl>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Test Status Breakdown */}
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Status dos Testes (30 dias)</h4>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{metrics.testStats.passed}</div>
                            <div className="text-xs text-gray-500">Aprovados</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{metrics.testStats.failed}</div>
                            <div className="text-xs text-gray-500">Falharam</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">{metrics.testStats.blocked}</div>
                            <div className="text-xs text-gray-500">Bloqueados</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-600">{metrics.testStats.skipped}</div>
                            <div className="text-xs text-gray-500">Pulados</div>
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
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Dashboard</dt>
                        <dd className="text-lg font-medium text-gray-900">Visão Geral</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="text-sm text-gray-600">
                      Acesse métricas e estatísticas do sistema
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Panel - Only for admin+ */}
              {hasPermission(userRole, 'view_admin') && (
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Admin</dt>
                          <dd className="text-lg font-medium text-gray-900">Painel Administrativo</dd>
                        </dl>
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="text-sm text-gray-600">
                        Gerencie usuários, empresas e configurações
                      </div>
                      <div className="mt-3">
                        <a
                          href="/admin"
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          Acessar →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Companies - Only for admin+ */}
              {hasPermission(userRole, 'manage_companies') && (
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Empresas</dt>
                          <dd className="text-lg font-medium text-gray-900">Gestão de Empresas</dd>
                        </dl>
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="text-sm text-gray-600">
                        Visualize e gerencie empresas cadastradas
                      </div>
                      <div className="mt-3">
                        <Link
                          href="/empresas"
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          Acessar →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Profile - For all users */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Perfil</dt>
                        <dd className="text-lg font-medium text-gray-900">Minha Conta</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="text-sm text-gray-600">
                      Gerencie suas informações pessoais e configurações
                    </div>
                    <div className="mt-3">
                      <a
                        href="/profile"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
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
