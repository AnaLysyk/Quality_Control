import { useState, useEffect } from 'react';
import { useRef } from 'react';

export interface SystemMetrics {
  overview: {
    totalUsers: number;
    totalCompanies: number;
    totalReleases: number;
    totalTestRuns: number;
    activeSessions: number;
  };
  testStats: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
  };
  releaseStats: {
    draft: number;
    published: number;
    archived: number;
  };
  lastUpdated: string;
}

/**
 * Hook para buscar e atualizar métricas globais do sistema.
 * Faz fetch em /api/metrics/overview, tenta refresh automático se 401.
 * Atualiza a cada 5 minutos e previne setState após unmount.
 */
export function useSystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Previne setState após unmount
  const isMounted = useRef(true);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchOverview = () =>
        fetch('/api/metrics/overview', { credentials: 'include', cache: 'no-store' });

      let response = await fetchOverview();
      if (response.status === 401) {
        const refreshed = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });
        if (refreshed.ok) {
          response = await fetchOverview();
        }
      }
      if (!response.ok) {
        throw new Error('Erro ao buscar métricas');
      }

      const data = await response.json();
      if (isMounted.current) setMetrics(data);
    } catch (err: unknown) {
      if (isMounted.current) setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchMetrics();

    // Atualizar métricas a cada 5 minutos
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, []);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
