import { TenantService } from "../src/tenancy/tenant.service";

type QueryResult = { data: any; error: any };

type Registry = {
  users?: QueryResult;
  company_users?: QueryResult;
};

class QueryBuilder {
  private readonly filters: Record<string, unknown> = {};

  constructor(private readonly table: string, private readonly registry: Registry) {}

  select() {
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters[key] = value;
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.resolve());
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ) {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private applyFilters(data: any) {
    if (!Array.isArray(data)) return data;
    return data.filter((row) =>
      Object.entries(this.filters).every(([key, value]) => (row as Record<string, unknown>)[key] === value),
    );
  }

  private resolve(): QueryResult {
    const empty: QueryResult = { data: null, error: null };
    if (this.table === "users") {
      return this.registry.users ?? empty;
    }
    if (this.table === "company_users") {
      const result = this.registry.company_users ?? empty;
      if (Array.isArray(result.data)) {
        return { ...result, data: this.applyFilters(result.data) };
      }
      return result;
    }
    return empty;
  }
}

function createSupabaseMock(registry: Registry) {
  return {
    from: (table: string) => new QueryBuilder(table, registry),
  };
}

describe("TenantService.resolve", () => {
  test("returns first active company link", async () => {
    const supabase = createSupabaseMock({
      users: {
        data: { id: "user-1", is_global_admin: false },
        error: null,
      },
      company_users: {
        data: [
          { user_id: "user-1", company_id: "company-1", role: "client_user", ativo: true },
          { user_id: "user-1", company_id: "company-2", role: "client_admin", ativo: true },
        ],
        error: null,
      },
    });

    const service = new TenantService({ supabase } as any);
    const ctx = await service.resolve("user-1");

    expect(ctx.companyId).toBe("company-1");
    expect(ctx.role).toBe("client_user");
    expect(ctx.isGlobalAdmin).toBe(false);
  });

  test("ignores inactive links", async () => {
    const supabase = createSupabaseMock({
      users: {
        data: { id: "user-2", is_global_admin: false },
        error: null,
      },
      company_users: {
        data: [{ user_id: "user-2", company_id: "company-3", role: "client_admin", ativo: false }],
        error: null,
      },
    });

    const service = new TenantService({ supabase } as any);
    const ctx = await service.resolve("user-2");

    expect(ctx.companyId).toBeNull();
    expect(ctx.role).toBeNull();
    expect(ctx.isGlobalAdmin).toBe(false);
  });

  test("lowercases role from company_users", async () => {
    const supabase = createSupabaseMock({
      users: {
        data: { id: "user-3", is_global_admin: false },
        error: null,
      },
      company_users: {
        data: [{ user_id: "user-3", company_id: "company-4", role: "CLIENT_ADMIN", ativo: true }],
        error: null,
      },
    });

    const service = new TenantService({ supabase } as any);
    const ctx = await service.resolve("user-3");

    expect(ctx.companyId).toBe("company-4");
    expect(ctx.role).toBe("client_admin");
    expect(ctx.isGlobalAdmin).toBe(false);
  });

  test("sets global admin role when users.is_global_admin is true", async () => {
    const supabase = createSupabaseMock({
      users: {
        data: { id: "user-4", is_global_admin: true },
        error: null,
      },
      company_users: {
        data: [],
        error: null,
      },
    });

    const service = new TenantService({ supabase } as any);
    const ctx = await service.resolve("user-4");

    expect(ctx.isGlobalAdmin).toBe(true);
    expect(ctx.role).toBe("global_admin");
    expect(ctx.companyId).toBeNull();
  });
});
