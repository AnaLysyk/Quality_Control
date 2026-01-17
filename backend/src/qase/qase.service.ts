import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { EnvironmentService } from "../config/environment.service";
import { CompanyIntegrationService } from "./company-integration.service";

const QASE_API_URL = "https://api.qase.io/v1";

type IntegrationContext = {
  token: string | null;
  projectCode: string | null;
  projectCodes: string[];
};

type RequestOptions = {
  path: string;
  params?: Record<string, string | number | undefined>;
  body?: unknown;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  companyId?: string;
  useCache?: boolean;
};

type CacheEntry = {
  expiresAt: number;
  promise: Promise<unknown>;
};

@Injectable()
export class QaseService {
  private readonly logger = new Logger(QaseService.name);
  private readonly defaultToken: string | null;
  private readonly defaultProject: string | null;
  private readonly integrationCache = new Map<string, { expiresAt: number; context: IntegrationContext }>();
  private readonly integrationTtlMs = 60 * 1000;
  private readonly responseCache = new Map<string, CacheEntry>();
  private readonly responseCacheTtlMs = 15 * 1000;

  constructor(
    private readonly env: EnvironmentService,
    private readonly integrationService: CompanyIntegrationService,
  ) {
    const defaultProject = this.env.getQaseDefaultProject();
    this.defaultToken = this.env.getQaseApiToken();
    this.defaultProject = defaultProject ? defaultProject.trim().toUpperCase() : null;
  }

  private buildHeaders(token: string | null, isFormData: boolean, hasBody: boolean) {
    if (!token) return null;
    const headers: Record<string, string> = {
      Token: token,
      Accept: "application/json",
    };
    if (hasBody && !isFormData) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  private preparePayload(body: unknown) {
    if (body === undefined || body === null) return { payload: undefined, isFormData: false };
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      return { payload: body, isFormData: true };
    }
    if (typeof body === "string") return { payload: body, isFormData: false };
    if (body instanceof ArrayBuffer) return { payload: body, isFormData: false };
    if (body instanceof Uint8Array) return { payload: body, isFormData: false };
    if (typeof Blob !== "undefined" && body instanceof Blob) {
      return { payload: body, isFormData: false };
    }
    return { payload: JSON.stringify(body), isFormData: false };
  }

  private getCacheKey(companyId: string | undefined, path: string, params?: Record<string, string | number | undefined>) {
    const parts = [`company:${companyId ?? "global"}`, `path:${path}`];
    if (params) {
      const sorted = Object.keys(params)
        .sort()
        .map((key) => `${key}:${String(params[key])}`);
      if (sorted.length) {
        parts.push(sorted.join(","));
      }
    }
    return parts.join("|");
  }

  private async fetchWithCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.responseCache.get(key);
    if (existing && existing.expiresAt > now) {
      return existing.promise as Promise<T>;
    }
    const promise = loader();
    this.responseCache.set(key, { expiresAt: now + this.responseCacheTtlMs, promise });
    try {
      return await promise;
    } catch (error) {
      const current = this.responseCache.get(key);
      if (current?.promise === promise) {
        this.responseCache.delete(key);
      }
      throw error;
    }
  }

  private async resolveIntegrationContext(companyId?: string): Promise<IntegrationContext> {
    const key = companyId ?? "global";
    const now = Date.now();
    const cached = this.integrationCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.context;
    }

    const projectCodes = new Set<string>();
    if (this.defaultProject) {
      projectCodes.add(this.defaultProject);
    }

    let projectCode = this.defaultProject;
    let token = this.defaultToken;

    if (companyId) {
      const settings = await this.integrationService.getSettings(companyId);
      if (settings) {
        if (settings.token) {
          token = settings.token;
        }
        if (settings.projectCode) {
          projectCode = settings.projectCode.toUpperCase();
          projectCodes.add(projectCode);
        }
        settings.projectCodes.forEach((entry) => {
          projectCodes.add(entry.toUpperCase());
        });
      }
    }

    const context: IntegrationContext = {
      token,
      projectCode,
      projectCodes: Array.from(projectCodes),
    };

    this.integrationCache.set(key, { expiresAt: now + this.integrationTtlMs, context });
    return context;
  }

  private async resolveProjectCode(companyId?: string, override?: string): Promise<string> {
    if (override) {
      const normalized = override.trim().toUpperCase();
      if (normalized) return normalized;
    }
    const context = await this.resolveIntegrationContext(companyId);
    return context.projectCode ?? "";
  }

  private normalizeProjectList(project?: string, context?: IntegrationContext): string[] {
    const param = typeof project === "string" ? project.trim().toUpperCase() : "";
    if (param) {
      return [param];
    }
    const list = context?.projectCodes ?? [];
    if (list.length) return list;
    if (context?.projectCode) return [context.projectCode];
    return [];
  }

  private async request<T>(options: RequestOptions): Promise<T | null> {
    const context = await this.resolveIntegrationContext(options.companyId);
    const { payload, isFormData } = this.preparePayload(options.body);
    const headers = this.buildHeaders(context.token, isFormData, payload !== undefined);
    if (!headers) {
      this.logger.warn(`Qase token missing for companyId=${options.companyId ?? "global"}`);
      return null;
    }

    const url = new URL(`${QASE_API_URL}${options.path}`);
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const execute = async () => {
      const response = await fetch(url.toString(), {
        method: options.method ?? "GET",
        headers,
        body: payload as BodyInit | undefined,
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Erro Qase ${response.status}: ${text}`);
        throw new HttpException({ error: "Erro ao consultar Qase", detail: text }, response.status as HttpStatus);
      }
      return (await response.json()) as T;
    };

    if (options.useCache && (options.method ?? "GET") === "GET") {
      const key = this.getCacheKey(options.companyId, options.path, options.params);
      return this.fetchWithCache(key, execute);
    }

    return execute();
  }

  async getProjects(companyId?: string) {
    const response = await this.request({ path: "/project", companyId, useCache: true });
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

  async getRuns(companyId?: string, project?: string) {
    const projectCode = await this.resolveProjectCode(companyId, project);
    const response = await this.request({
      path: `/run/${projectCode}`,
      params: { limit: 50 },
      companyId,
      useCache: true,
    });
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

  async createRun(companyId: string | undefined, input: { project?: string; title?: string; description?: string; custom_type?: string }) {
    const projectCode = (await this.resolveProjectCode(companyId, input.project)).trim();
    const title = (input.title ?? "").trim();
    const description = input.description || "";

    if (!projectCode || !title) {
      throw new HttpException({ error: "Projeto e titulo sao obrigatorios" }, HttpStatus.BAD_REQUEST);
    }

    const payload: Record<string, unknown> = { title, description };
    if (input.custom_type) {
      payload.custom_fields = { custom_type: input.custom_type };
    }

    const response = await this.request({
      path: `/run/${encodeURIComponent(projectCode)}`,
      method: "POST",
      body: payload,
      companyId,
    });
    if (response) return response;

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

  async getRunDetail(projectCode: string, runId: number, companyId?: string) {
    const response = await this.request({
      path: `/run/${projectCode}/${runId}`,
      companyId,
      useCache: true,
    });
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

  async getRunCases(projectCode: string, runId: number, companyId?: string) {
    const pageSize = 200;
    let page = 1;
    const allCases: Array<Record<string, unknown>> = [];

    while (true) {
      const response = await this.request({
        path: `/run/${projectCode}/${runId}/cases`,
        params: { page, limit: pageSize },
        companyId,
      });

      if (!response) {
        const fallback = await this.request({
          path: `/result/${projectCode}`,
          params: { run_id: runId },
          companyId,
        });
        return (fallback as any)?.result?.entities ?? [];
      }

      const entities = (response as any)?.result?.entities ?? [];
      allCases.push(...(entities as Array<Record<string, unknown>>));

      if (entities.length < pageSize) break;
      page += 1;
    }

    return allCases;
  }

  async getDefects(companyId?: string, project?: string) {
    const context = await this.resolveIntegrationContext(companyId);
    const projects = this.normalizeProjectList(project, context);
    if (!projects.length) {
      return { status: true, result: { count: 0, entities: [] } };
    }

    if (!context.token) {
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

    const aggregated: unknown[] = [];
    for (const projectCode of projects) {
      const response = await this.request({
        path: `/defect/${projectCode}`,
        params: { limit: 100, offset: 0 },
        companyId,
      });
      const entities = (response as any)?.result?.entities ?? [];
      if (Array.isArray(entities)) {
        entities.forEach((entity) => {
          if (entity && typeof entity === "object") {
            (entity as any).project = (entity as any).project ?? projectCode;
            (entity as any).project_code = (entity as any).project_code ?? projectCode;
          }
        });
        aggregated.push(...entities);
      }
    }

    return {
      status: true,
      result: {
        count: aggregated.length,
        entities: aggregated,
      },
    };
  }
}
