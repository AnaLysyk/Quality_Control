import { useState, useEffect } from 'react';

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

export function useSystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

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
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Atualizar métricas a cada 5 minutos
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
