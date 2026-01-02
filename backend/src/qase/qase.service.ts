import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";

const QASE_API_URL = "https://api.qase.io/v1";

@Injectable()
export class QaseService {
  private readonly logger = new Logger(QaseService.name);
  private readonly token = process.env.QASE_API_TOKEN || "";
  private readonly defaultProject = process.env.QASE_DEFAULT_PROJECT || "";

  private get headers() {
    if (!this.token) return null;
    return {
      Token: this.token,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private async request<T>(path: string, params?: Record<string, string | number | undefined>) {
    if (!this.headers) {
      this.logger.warn("QASE_API_TOKEN ausente, retornando dados de exemplo");
      return null;
    }

    const url = new URL(`${QASE_API_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers,
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Erro Qase ${res.status}: ${text}`);
      throw new HttpException(
        { error: "Erro ao consultar Qase", detail: text },
        res.status as HttpStatus
      );
    }

    return (await res.json()) as T;
  }

  async getProjects() {
    const response = await this.request("/project");
    if (response) return response;

    return {
      status: true,
      result: {
        count: 3,
        entities: [
          { code: "SFQ", title: "Projeto SmartFox QA" },
          { code: "CDS", title: "Projeto Cards" },
          { code: "GMT", title: "Projeto Gametime" },
        ],
      },
      sample: true,
    };
  }

  async getRuns(project?: string) {
    const projectCode = project || this.defaultProject;
    const response = await this.request(`/run/${projectCode}`, { limit: 50 });
    if (response) return response;

    return {
      status: true,
      result: {
        count: 2,
        entities: [
          {
            id: 11,
            title: "RELEASE 1.7.0 - Aceitação (SPRINT 1/2)",
            status_text: "failed",
            stats: { total: 55, passed: 50, failed: 5 },
            start_time: "2025-08-11T11:36:23+00:00",
            end_time: "2025-08-15T14:42:51+00:00",
          },
          {
            id: 10,
            title: "RELEASE 1.6.2 - Regressão",
            status_text: "failed",
            stats: { total: 182, passed: 160, failed: 21 },
            start_time: "2025-08-11T08:30:00+00:00",
            end_time: "2025-08-15T14:00:00+00:00",
          },
        ],
      },
      sample: true,
    };
  }

  async getRunDetail(projectCode: string, runId: number) {
    const response = await this.request(`/run/${projectCode}/${runId}`);
    if (response) return response;

    return {
      status: true,
      result: {
        id: runId,
        title: `Run ${runId} (sample)`,
        description: "Detalhes de exemplo - configure QASE_API_TOKEN para dados reais.",
      },
      sample: true,
    };
  }

  async getRunCases(projectCode: string, runId: number) {
    const pageSize = 200;
    let page = 1;
    const allCases: Array<Record<string, unknown>> = [];

    while (true) {
      const response = await this.request(
        `/run/${projectCode}/${runId}/cases`,
        {
          page,
          limit: pageSize,
        }
      );

      if (!response) {
        // Fallback para resultados quando token ausente
        const results = await this.request(
          `/result/${projectCode}`,
          { run_id: runId }
        );
        return results?.result?.entities ?? [];
      }

      const entities = response.result?.entities ?? [];
      allCases.push(...entities);

      if (entities.length < pageSize) break;
      page += 1;
    }

    return allCases;
  }
}
