import { jest } from "@jest/globals";

type SupabaseAuthResponse = {
  data: { user: { id: string; email?: string | null } | null };
  error: unknown;
};

type SupabaseServerMock = {
  auth: {
    getUser: jest.Mock<(token?: string) => Promise<SupabaseAuthResponse>>;
  };
  from: jest.Mock<(table: string) => any>;
};

type QueryResponse<T> = {
  data: T;
  error: unknown;
};

type MockFn = ReturnType<typeof jest.fn>;

type ChainableQuery<T> = QueryResponse<T> & {
  select: MockFn;
  order: MockFn;
  eq: MockFn;
  match: MockFn;
  ilike: MockFn;
  limit: MockFn;
  update: MockFn;
  insert: MockFn;
  delete: MockFn;
  maybeSingle: MockFn;
  in: MockFn;
  then: <TResult1 = QueryResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ) => Promise<QueryResponse<T> | TResult>;
  finally: (onfinally?: (() => void) | null) => Promise<QueryResponse<T>>;
};

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return [...value];
  if (value === null || value === undefined) return [];
  return [value];
}

export function buildQueryResponse<T>(response: QueryResponse<T>): ChainableQuery<T> {
  const chain: Partial<ChainableQuery<T>> = {
    data: response.data,
    error: response.error,
  };

  const method = () => jest.fn().mockReturnValue(chain);

  chain.select = method();
  chain.order = method();
  chain.eq = method();
  chain.match = method();
  chain.ilike = method();
  chain.limit = method();
  chain.update = method();
  chain.insert = method();
  chain.delete = method();

  chain.maybeSingle = jest
    .fn<() => Promise<QueryResponse<T>>>()
    .mockResolvedValue({ data: response.data, error: response.error });

  chain.in = jest
    .fn<(column: string, values: Array<string | number>) => Promise<QueryResponse<T[]>>>()
    .mockImplementation((column: string, values: Array<string | number>) => {
    const dataset = toArray(response.data);
    const filtered = dataset.filter((row) => {
      const record = row as Record<string, unknown>;
      const raw = record[column];
      if (typeof raw === "string" || typeof raw === "number") {
        return values.map(String).includes(String(raw));
      }
      if (raw && typeof raw === "object" && "toString" in raw) {
        return values.map(String).includes(String(raw));
      }
      return false;
    }) as T[];

    return Promise.resolve({ data: filtered, error: response.error });
    });

  const basePromise: Promise<QueryResponse<T>> = Promise.resolve({ data: response.data, error: response.error });
  chain.then = basePromise.then.bind(basePromise);
  chain.catch = basePromise.catch.bind(basePromise);
  chain.finally = basePromise.finally.bind(basePromise);

  return chain as ChainableQuery<T>;
}

export function createSupabaseServerMock(): SupabaseServerMock {
  return {
    auth: {
      getUser: jest.fn<(token?: string) => Promise<SupabaseAuthResponse>>(),
    },
    from: jest.fn<(table: string) => any>(),
  };
}

export function resetSupabaseServerMock(mock: SupabaseServerMock): void {
  mock.auth.getUser.mockReset();
  mock.from.mockReset();
}

export type { SupabaseServerMock };
