import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { EnvironmentService } from "../config/environment.service";

const QASE_API_URL = "https://api.qase.io/v1";

@Injectable()
export class QaseService {
  private readonly logger = new Logger(QaseService.name);
  private readonly token: string | null;
  private readonly defaultProject: string | null;

  constructor(private readonly env: EnvironmentService) {
    this.token = this.env.getQaseApiToken();
    this.defaultProject = this.env.getQaseDefaultProject();
  }

  private get headers() {
    if (!this.token) return null;
    return {
      Token: this.token,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private async request<T = any>(path: string, params?: Record<string, string | number | undefined>): Promise<T | null> {
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

  private normalizeProjectList(project?: string): string[] {
    const p = (project || "").trim();
    if (!p || p.toUpperCase() === "ALL") {
      const list = this.env.getQaseProjectsList();
      if (list.length) return list;
      return this.defaultProject ? [this.defaultProject] : [];
    }
    return [p];
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
    const projectCode = project || this.defaultProject || "";
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

  async createRun(input: { project?: string; title?: string; description?: string; custom_type?: string }) {
    const projectCode = (input.project || this.defaultProject || "").trim();
    const title = (input.title || "").trim();
    const description = input.description || "";

    if (!projectCode || !title) {
      throw new HttpException({ error: "Projeto e titulo sao obrigatorios" }, HttpStatus.BAD_REQUEST);
    }

    if (!this.headers) {
      return {
        status: true,
        result: {
          id: 999,
          title,
          description,
          project: projectCode,
          sample: true,
        },
        sample: true,
      };
    }

    const payload: Record<string, unknown> = { title, description };
    if (input.custom_type) {
      payload.custom_fields = { custom_type: input.custom_type };
    }

    const res = await fetch(`${QASE_API_URL}/run/${encodeURIComponent(projectCode)}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Erro Qase ${res.status}: ${text}`);
      throw new HttpException({ error: "Erro ao criar run", detail: text }, res.status as HttpStatus);
    }

    return (await res.json()) as unknown;
  }

  async getDefects(project?: string) {
    const projects = this.normalizeProjectList(project);
    if (!projects.length) {
      return { status: true, result: { count: 0, entities: [] } };
    }

    if (!this.headers) {
      return {
        status: true,
        result: {
          count: 1,
          entities: [
            { id: 1, title: "Defeito de exemplo", status: "open", severity: "medium", project: projects[0] },
          ],
        },
        sample: true,
      };
    }

    const all: unknown[] = [];
    for (const projectCode of projects) {
      const response = await this.request(`/defect/${projectCode}`, { limit: 100, offset: 0 });
      const entities = (response as any)?.result?.entities ?? [];
      if (Array.isArray(entities)) {
        entities.forEach((e) => {
          if (e && typeof e === "object") {
            (e as any).project = (e as any).project ?? projectCode;
            (e as any).project_code = (e as any).project_code ?? projectCode;
          }
        });
        all.push(...entities);
      }
    }

    return {
      status: true,
      result: {
        count: all.length,
        entities: all,
      },
    };
  }
}
