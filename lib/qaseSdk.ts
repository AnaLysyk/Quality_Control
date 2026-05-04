type RequestOptions = {
  params?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  cache?: RequestCache;
};

export class QaseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "QaseError";
    this.status = status;
  }
}

export type QaseClientOptions = {
  token: string;
  baseUrl?: string;
  defaultFetchOptions?: RequestInit;
};

export class QaseClient {
  private token: string;
  private baseUrl: string;
  private defaultFetchOptions?: RequestInit;

  constructor(options: QaseClientOptions) {
    this.token = options.token;
    this.baseUrl = (options.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
    this.defaultFetchOptions = options.defaultFetchOptions;
  }

  getUrl(path: string) {
    return `${this.baseUrl}/v1${path.startsWith("/") ? "" : "/"}${path}`;
  }

  private buildUrl(path: string, params?: Record<string, string | number | undefined>) {
    const url = new URL(this.getUrl(path));
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  }

  async getWithStatus<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; status: number }> {
    const url = this.buildUrl(path, options.params);
    const headers = {
      Token: this.token,
      Accept: "application/json",
      ...(options.headers ?? {}),
    };

    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: options.cache ?? this.defaultFetchOptions?.cache,
      ...this.defaultFetchOptions,
    });

    if (!res.ok) {
      throw new QaseError(`Qase request failed: ${res.status}`, res.status);
    }

    const json = (await res.json().catch(() => ({}))) as T;
    return { data: json, status: res.status };
  }

  async postWithStatus<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<{ data: T; status: number }> {
    const url = this.buildUrl(path, options.params);
    const headers = {
      Token: this.token,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: options.cache ?? this.defaultFetchOptions?.cache,
      ...this.defaultFetchOptions,
    });

    if (!res.ok) {
      throw new QaseError(`Qase request failed: ${res.status}`, res.status);
    }

    const json = (await res.json().catch(() => ({}))) as T;
    return { data: json, status: res.status };
  }

  async patchWithStatus<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<{ data: T; status: number }> {
    const url = this.buildUrl(path, options.params);
    const headers = {
      Token: this.token,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    };

    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: options.cache ?? this.defaultFetchOptions?.cache,
      ...this.defaultFetchOptions,
    });

    if (!res.ok) {
      throw new QaseError(`Qase request failed: ${res.status}`, res.status);
    }

    const json = (await res.json().catch(() => ({}))) as T;
    return { data: json, status: res.status };
  }

  async deleteWithStatus<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; status: number }> {
    const url = this.buildUrl(path, options.params);
    const headers = {
      Token: this.token,
      Accept: "application/json",
      ...(options.headers ?? {}),
    };

    const res = await fetch(url, {
      method: "DELETE",
      headers,
      cache: options.cache ?? this.defaultFetchOptions?.cache,
      ...this.defaultFetchOptions,
    });

    if (!res.ok) {
      throw new QaseError(`Qase request failed: ${res.status}`, res.status);
    }

    const json = (await res.json().catch(() => ({}))) as T;
    return { data: json, status: res.status };
  }

  async listPlans(
    projectCode: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<{ result?: { entities?: unknown[] } }> {
    const { data } = await this.getWithStatus<{ result?: { entities?: unknown[] } }>(`/plan/${projectCode}`, {
      params,
    });
    return data;
  }

  async getPlan(projectCode: string, planId: string | number): Promise<{ result?: unknown }> {
    const { data } = await this.getWithStatus<{ result?: unknown }>(
      `/plan/${projectCode}/${encodeURIComponent(String(planId))}`,
      { cache: "no-store" },
    );
    return data;
  }

  async createPlan(projectCode: string, body: Record<string, unknown>) {
    const { data } = await this.postWithStatus<{ result?: unknown }>(`/plan/${projectCode}`, body);
    return data;
  }

  async updatePlan(projectCode: string, planId: string | number, body: Record<string, unknown>) {
    const { data } = await this.patchWithStatus<{ result?: unknown }>(
      `/plan/${projectCode}/${encodeURIComponent(String(planId))}`,
      body,
    );
    return data;
  }

  async deletePlan(projectCode: string, planId: string | number) {
    const { data } = await this.deleteWithStatus<{ result?: unknown }>(
      `/plan/${projectCode}/${encodeURIComponent(String(planId))}`,
    );
    return data;
  }

  // ── Results ────────────────────────────────────────────────────────────────

  async listResults(projectCode: string, params?: Record<string, string | number | undefined>) {
    const { data } = await this.getWithStatus<{ result?: { entities?: unknown[]; total?: number; count?: number } }>(
      `/result/${encodeURIComponent(projectCode)}`,
      { params, cache: "no-store" },
    );
    return data;
  }

  async getResult(projectCode: string, hash: string) {
    const { data } = await this.getWithStatus<{ result?: unknown }>(
      `/result/${encodeURIComponent(projectCode)}/${encodeURIComponent(hash)}`,
      { cache: "no-store" },
    );
    return data;
  }

  async createResult(projectCode: string, runId: number, body: Record<string, unknown>) {
    const { data } = await this.postWithStatus<{ result?: { case_id?: number; hash?: string } }>(
      `/result/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(runId))}`,
      body,
    );
    return data;
  }

  async bulkCreateResults(projectCode: string, runId: number, body: { results: Record<string, unknown>[] }) {
    const { data } = await this.postWithStatus<{ status?: boolean }>(
      `/result/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(runId))}/bulk`,
      body,
    );
    return data;
  }

  async updateResult(projectCode: string, runId: number, hash: string, body: Record<string, unknown>) {
    const { data } = await this.patchWithStatus<{ result?: { hash?: string } }>(
      `/result/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(runId))}/${encodeURIComponent(hash)}`,
      body,
    );
    return data;
  }

  async deleteResult(projectCode: string, runId: number, hash: string) {
    const { data } = await this.deleteWithStatus<{ result?: { hash?: string } }>(
      `/result/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(runId))}/${encodeURIComponent(hash)}`,
    );
    return data;
  }

  // ── Cases ──────────────────────────────────────────────────────────────────

  async listCases(projectCode: string, params?: Record<string, string | number | undefined>) {
    const { data } = await this.getWithStatus<{ result?: { entities?: unknown[]; total?: number; count?: number } }>(
      `/case/${encodeURIComponent(projectCode)}`,
      { params, cache: "no-store" },
    );
    return data;
  }

  async getCase(projectCode: string, caseId: number) {
    const { data } = await this.getWithStatus<{ result?: unknown }>(
      `/case/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(caseId))}`,
      { cache: "no-store" },
    );
    return data;
  }

  async createCase(projectCode: string, body: Record<string, unknown>) {
    const { data } = await this.postWithStatus<{ result?: { id?: number } }>(
      `/case/${encodeURIComponent(projectCode)}`,
      body,
    );
    return data;
  }

  async bulkCreateCases(projectCode: string, body: { cases: Record<string, unknown>[] }) {
    const { data } = await this.postWithStatus<{ result?: { ids?: number[] } }>(
      `/case/${encodeURIComponent(projectCode)}/bulk`,
      body,
    );
    return data;
  }

  async updateCase(projectCode: string, caseId: number, body: Record<string, unknown>) {
    const { data } = await this.patchWithStatus<{ result?: { id?: number } }>(
      `/case/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(caseId))}`,
      body,
    );
    return data;
  }

  async deleteCase(projectCode: string, caseId: number) {
    const { data } = await this.deleteWithStatus<{ result?: { id?: number } }>(
      `/case/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(caseId))}`,
    );
    return data;
  }

  async attachExternalIssues(projectCode: string, body: Record<string, unknown>) {
    const { data } = await this.postWithStatus<{ status?: boolean }>(
      `/case/${encodeURIComponent(projectCode)}/external-issue/attach`,
      body,
    );
    return data;
  }

  async detachExternalIssues(projectCode: string, body: Record<string, unknown>) {
    const { data } = await this.postWithStatus<{ status?: boolean }>(
      `/case/${encodeURIComponent(projectCode)}/external-issue/detach`,
      body,
    );
    return data;
  }

  // ── Authors ────────────────────────────────────────────────────────────────

  async listAuthors(params?: Record<string, string | number | undefined>) {
    const { data } = await this.getWithStatus<{ result?: { entities?: unknown[]; total?: number; count?: number } }>(
      `/author`,
      { params, cache: "no-store" },
    );
    return data;
  }

  async getAuthor(id: number) {
    const { data } = await this.getWithStatus<{ result?: unknown }>(
      `/author/${encodeURIComponent(String(id))}`,
      { cache: "no-store" },
    );
    return data;
  }

  async deleteRun(projectCode: string, runId: number) {
    const { data } = await this.deleteWithStatus<{ status?: boolean; result?: { id?: number } }>(
      `/run/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(runId))}`,
    );
    return data;
  }

  async updateRun(projectCode: string, runId: number, body: Record<string, unknown>) {
    const { data } = await this.patchWithStatus<{ status?: boolean }>(
      `/run/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(runId))}`,
      body,
    );
    return data;
  }

  async completeRun(projectCode: string, runId: number) {
    const { data } = await this.postWithStatus<{ status?: boolean }>(
      `/run/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(runId))}/complete`,
    );
    return data;
  }

  async updateRunPublicity(projectCode: string, runId: number, isPublic: boolean) {
    const { data } = await this.patchWithStatus<{ status?: boolean; result?: { url?: string } }>(
      `/run/${encodeURIComponent(projectCode)}/${encodeURIComponent(String(runId))}/public`,
      { status: isPublic },
    );
    return data;
  }
}

export function createQaseClient(options: QaseClientOptions) {
  return new QaseClient(options);
}
