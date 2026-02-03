export type AuthLoginInput = { user: string; password: string };
export type AuthLoginResult = { ok: true };

export type AuthMeResult = {
  user: Record<string, unknown>;
  companies: Array<Record<string, unknown>>;
};

export type CompanyCreateInput = {
  name?: string;
  company_name?: string;
  slug?: string;
};

export type DataSource = {
  auth: {
    login: (input: AuthLoginInput) => Promise<AuthLoginResult>;
    me: () => Promise<AuthMeResult>;
    logout: () => Promise<void>;
  };
  companies: {
    list: () => Promise<Array<Record<string, unknown>>>;
    create: (input: CompanyCreateInput) => Promise<Record<string, unknown>>;
  };
  users: {
    list: (clientId?: string | null) => Promise<Array<Record<string, unknown>>>;
  };
};
