export type QaseVersion = "v1" | "v2";
export type QaseAuthStyle = "token" | "bearer" | "both";

export type QaseApiResponse<T> = {
  status: boolean;
  result: T;
  errorMessage?: string;
  errorFields?: unknown;
};

export type QaseListResult<T> = {
  count?: number;
  entities?: T[];
};

export type QaseListResponse<T> = QaseApiResponse<QaseListResult<T>>;

export type QaseClientOptions = {
  baseUrl?: string;
  token?: string;
  authStyle?: QaseAuthStyle;
  defaultHeaders?: Record<string, string>;
  defaultFetchOptions?: RequestInit;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

export type QaseRequestOptions = {
  version?: QaseVersion;
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  body?: unknown;
  fetchOptions?: RequestInit;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export class QaseError extends Error {
  status: number;
  url: string;
  responseText: string;
  data?: unknown;

  constructor(params: { status: number; url: string; responseText: string; data?: unknown }) {
    super(`Qase request failed (${params.status})`);
    this.name = "QaseError";
    this.status = params.status;
    this.url = params.url;
    this.responseText = params.responseText;
    this.data = params.data;
  }
}

export class QaseClient {
  private baseUrl: string;
  private token: string;
  private authStyle: QaseAuthStyle;
  private defaultHeaders?: Record<string, string>;
  private defaultFetchOptions?: RequestInit;
  private fetcher: typeof fetch;
  private timeoutMs?: number;

  constructor(options: QaseClientOptions = {}) {
    const base =
      options.baseUrl ||
      process.env.QASE_BASE_URL ||
      "https://api.qase.io";
    const normalizedBase = base.replace(/\/(v1|v2)\/?$/, "");
    this.baseUrl = normalizedBase.endsWith("/") ? normalizedBase.slice(0, -1) : normalizedBase;
    this.token = options.token || process.env.QASE_API_TOKEN || process.env.QASE_TOKEN || "";
    this.authStyle = options.authStyle ?? "both";
    this.defaultHeaders = options.defaultHeaders;
    this.defaultFetchOptions = options.defaultFetchOptions;
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs;
  }

  get hasToken() {
    return Boolean(this.token);
  }

  getUrl(path: string, version: QaseVersion = "v1") {
    return this.buildUrl(path, version);
  }

  async request<T>(method: string, path: string, options: QaseRequestOptions = {}): Promise<T> {
    const { data } = await this.requestWithStatus<T>(method, path, options);
    return data;
  }

  async requestWithStatus<T>(
    method: string,
    path: string,
    options: QaseRequestOptions = {}
  ): Promise<{ data: T; status: number }> {
    const response = await this.send(method, path, options);
    const data = await this.readJson<T>(response);
    return { data, status: response.status };
  }

  get<T>(path: string, options?: QaseRequestOptions) {
    return this.request<T>("GET", path, options);
  }

  getWithStatus<T>(path: string, options?: QaseRequestOptions) {
    return this.requestWithStatus<T>("GET", path, options);
  }

  post<T>(path: string, options?: QaseRequestOptions) {
    return this.request<T>("POST", path, options);
  }

  patch<T>(path: string, options?: QaseRequestOptions) {
    return this.request<T>("PATCH", path, options);
  }

  delete<T>(path: string, options?: QaseRequestOptions) {
    return this.request<T>("DELETE", path, options);
  }

  listProjects() {
    return this.get<QaseListResponse<Record<string, unknown>>>("/project");
  }

  getProject(code: string) {
    return this.get<QaseApiResponse<Record<string, unknown>>>(`/project/${code}`);
  }

  listSuites(projectCode: string, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/suite/${projectCode}`, { params });
  }

  createSuite(projectCode: string, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/suite/${projectCode}`, {
      body: payload,
    });
  }

  listCases(projectCode: string, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/case/${projectCode}`, { params });
  }

  getCase(projectCode: string, caseId: number) {
    return this.get<QaseApiResponse<Record<string, unknown>>>(`/case/${projectCode}/${caseId}`);
  }

  createCase(projectCode: string, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/case/${projectCode}`, {
      body: payload,
    });
  }

  updateCase(projectCode: string, caseId: number, payload: Record<string, unknown>) {
    return this.patch<QaseApiResponse<Record<string, unknown>>>(`/case/${projectCode}/${caseId}`, {
      body: payload,
    });
  }

  deleteCase(projectCode: string, caseId: number) {
    return this.delete<QaseApiResponse<Record<string, unknown>>>(`/case/${projectCode}/${caseId}`);
  }

  bulkCases(projectCode: string, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/case/${projectCode}/bulk`, {
      body: payload,
    });
  }

  listRuns(projectCode: string, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/run/${projectCode}`, { params });
  }

  getRun(projectCode: string, runId: number) {
    return this.get<QaseApiResponse<Record<string, unknown>>>(`/run/${projectCode}/${runId}`);
  }

  createRun(projectCode: string, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/run/${projectCode}`, {
      body: payload,
    });
  }

  completeRun(projectCode: string, runId: number) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/run/${projectCode}/${runId}/complete`);
  }

  listRunCases<T = Record<string, unknown>>(projectCode: string, runId: number, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<T>>(`/run/${projectCode}/${runId}/cases`, { params });
  }

  async listAllRunCases<T = Record<string, unknown>>(params: {
    projectCode: string;
    runId: number;
    pageSize?: number;
    extraParams?: QaseRequestOptions["params"];
    fallbackToResults?: boolean;
    resultPageSize?: number;
  }) {
    const pageSize = params.pageSize ?? 200;
    let page = 1;
    const all: T[] = [];

    try {
      while (true) {
        const response = await this.listRunCases<T>(params.projectCode, params.runId, {
          ...(params.extraParams ?? {}),
          page,
          limit: pageSize,
        });
        const entities = response.result?.entities ?? [];
        if (!entities.length) break;
        all.push(...entities);
        if (entities.length < pageSize) break;
        page += 1;
      }
      return all;
    } catch (err) {
      if (params.fallbackToResults && err instanceof QaseError && err.status === 404) {
        return this.listAllResults<T>({
          projectCode: params.projectCode,
          runId: params.runId,
          limit: params.resultPageSize,
        });
      }
      throw err;
    }
  }

  listResults(projectCode: string, runId: number, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/result/${projectCode}/${runId}`, { params });
  }

  listResultsLegacy<T = Record<string, unknown>>(projectCode: string, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<T>>(`/result/${projectCode}`, { params });
  }

  async listAllResults<T = Record<string, unknown>>(params: {
    projectCode: string;
    runId: number;
    limit?: number;
    extraParams?: QaseRequestOptions["params"];
  }) {
    const limit = params.limit ?? 250;
    let offset = 0;
    const all: T[] = [];

    while (true) {
      const response = await this.listResultsLegacy<T>(params.projectCode, {
        run_id: params.runId,
        limit,
        offset,
        ...(params.extraParams ?? {}),
      });
      const entities = response.result?.entities ?? [];
      if (!entities.length) break;
      all.push(...entities);
      if (entities.length < limit) break;
      offset += limit;
      if (response.result?.count && all.length >= response.result.count) break;
    }

    return all;
  }

  createResult(projectCode: string, runId: number, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/result/${projectCode}/${runId}`, {
      body: payload,
    });
  }

  listMilestones(projectCode: string, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/milestone/${projectCode}`, { params });
  }

  createMilestone(projectCode: string, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/milestone/${projectCode}`, {
      body: payload,
    });
  }

  listUsers(params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/user`, { params });
  }

  listConfigurations(projectCode: string, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/configuration/${projectCode}`, { params });
  }

  createConfiguration(projectCode: string, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/configuration/${projectCode}`, {
      body: payload,
    });
  }

  listEnvironments(projectCode: string, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/environment/${projectCode}`, { params });
  }

  createEnvironment(projectCode: string, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/environment/${projectCode}`, {
      body: payload,
    });
  }

  listAttachments(params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/attachment`, { params });
  }

  uploadAttachment(projectCode: string, formData: FormData) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/attachment/${projectCode}`, {
      body: formData,
    });
  }

  listDefectsV2(projectCode: string, params?: QaseRequestOptions["params"]) {
    return this.get<QaseListResponse<Record<string, unknown>>>(`/defect/${projectCode}`, {
      params,
      version: "v2",
    });
  }

  createResultV2(projectCode: string, runId: number, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/${projectCode}/run/${runId}/result`, {
      body: payload,
      version: "v2",
    });
  }

  createResultsBulkV2(projectCode: string, runId: number, payload: Record<string, unknown>) {
    return this.post<QaseApiResponse<Record<string, unknown>>>(`/${projectCode}/run/${runId}/results`, {
      body: payload,
      version: "v2",
    });
  }

  private buildUrl(path: string, version: QaseVersion) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    if (normalized.startsWith("/v1/") || normalized.startsWith("/v2/")) {
      return `${this.baseUrl}${normalized}`;
    }
    return `${this.baseUrl}/${version}${normalized}`;
  }

  private buildHeaders(isFormData: boolean, hasBody: boolean, extra?: Record<string, string>) {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(this.defaultHeaders ?? {}),
    };

    if (this.token) {
      if (this.authStyle === "token" || this.authStyle === "both") {
        headers.Token = this.token;
      }
      if (this.authStyle === "bearer" || this.authStyle === "both") {
        headers.Authorization = `Bearer ${this.token}`;
      }
    }

    const merged = { ...headers, ...(extra ?? {}) };
    if (hasBody && !isFormData && !merged["Content-Type"]) {
      merged["Content-Type"] = "application/json";
    }

    return merged;
  }

  private prepareBody(body: unknown): { payload?: BodyInit; isFormData: boolean } {
    if (body === undefined || body === null) return { payload: undefined, isFormData: false };
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      return { payload: body, isFormData: true };
    }
    if (typeof body === "string") return { payload: body, isFormData: false };
    if (body instanceof ArrayBuffer) return { payload: body, isFormData: false };
    if (body instanceof Uint8Array) return { payload: body, isFormData: false };
    if (typeof Blob !== "undefined" && body instanceof Blob) return { payload: body, isFormData: false };
    return { payload: JSON.stringify(body), isFormData: false };
  }

  private async send(method: string, path: string, options: QaseRequestOptions) {
    const version = options.version ?? "v1";
    const url = new URL(this.buildUrl(path, version));
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const { payload, isFormData } = this.prepareBody(options.body);
    const headers = this.buildHeaders(isFormData, payload !== undefined, options.headers);
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    let signal = options.signal ?? options.fetchOptions?.signal;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (!signal && timeoutMs) {
      const controller = new AbortController();
      signal = controller.signal;
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    const init: RequestInit = {
      ...(this.defaultFetchOptions ?? {}),
      ...(options.fetchOptions ?? {}),
      method,
      headers,
      signal,
    };

    if (method !== "GET" && method !== "HEAD" && payload !== undefined) {
      init.body = payload;
    }

    const response = await this.fetcher(url.toString(), init);
    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      const responseText = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = undefined;
      }
      throw new QaseError({
        status: response.status,
        url: url.toString(),
        responseText,
        data,
      });
    }

    return response;
  }

  private async readJson<T>(response: Response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return (await response.text()) as unknown as T;
    }
    return (await response.json()) as T;
  }
}

export function createQaseClient(options: QaseClientOptions = {}) {
  return new QaseClient(options);
}
