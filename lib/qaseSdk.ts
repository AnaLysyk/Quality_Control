
/**
 * Opções para requisições HTTP do QaseClient.
 */
type RequestOptions = {
  /** Parâmetros de query string */
  params?: Record<string, string | number | undefined>;
  /** Headers adicionais */
  headers?: Record<string, string>;
  /** Política de cache */
  cache?: RequestCache;
};


/**
 * Erro customizado para requisições Qase.
 * Inclui o status HTTP retornado pela API.
 */
export class QaseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "QaseError";
    this.status = status;
  }
}


/**
 * Opções de configuração do QaseClient.
 */
export type QaseClientOptions = {
  /** Token de API Qase */
  token: string;
  /** URL base da API Qase (opcional) */
  baseUrl?: string;
  /** Opções padrão para fetch (opcional) */
  defaultFetchOptions?: RequestInit;
};


/**
 * Cliente para integração com a API Qase.
 * Permite requisições autenticadas para recursos de projetos, execuções e resultados.
 */
export class QaseClient {
  private token: string;
  private baseUrl: string;
  private defaultFetchOptions?: RequestInit;

  /**
   * Cria uma instância do QaseClient.
   * @param options Opções de configuração
   */
  constructor(options: QaseClientOptions) {
    this.token = options.token;
    this.baseUrl = (options.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/$/, "");
    this.defaultFetchOptions = options.defaultFetchOptions;
  }

  /**
   * Monta a URL base da API para um path.
   */
  getUrl(path: string) {
    return `${this.baseUrl}/v1${path.startsWith("/") ? "" : "/"}${path}`;
  }

  /**
   * Monta a URL completa com query params.
   */
  private buildUrl(path: string, params?: Record<string, string | number | undefined>) {
    const url = new URL(this.getUrl(path));
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  }

  /**
   * Realiza um GET autenticado e retorna dados e status.
   */
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

  /**
   * Realiza um POST autenticado e retorna dados e status.
   */
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

  /**
   * Lista planos de teste de um projeto Qase.
   */
  async listPlans(
    projectCode: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<{ result?: { entities?: unknown[] } }> {
    const { data } = await this.getWithStatus<{ result?: { entities?: unknown[] } }>(`/plan/${projectCode}`, {
      params,
    });
    return data;
  }

  /**
   * Cria um resultado de execução para um run Qase.
   */
  async createResult(projectCode: string, runId: number, body: Record<string, unknown>) {
    // Qase API accepts creating a result for a run via /run/{runId}/result
    const path = `/run/${runId}/result`;
    const { data } = await this.postWithStatus<{ result?: unknown }>(path, body);
    return data;
  }
}


/**
 * Cria uma instância do QaseClient.
 * @param options Opções de configuração
 * @returns Instância QaseClient
 */
export function createQaseClient(options: QaseClientOptions) {
  return new QaseClient(options);
}
