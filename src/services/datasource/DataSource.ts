export type AuthLoginInput = { login?: string; email?: string; user?: string; password: string };
export type AuthLoginResult = { ok: true };

export type AuthMeResult = {
  user: any;
  companies: any[];
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
    list: () => Promise<any[]>;
    create: (input: CompanyCreateInput) => Promise<any>;
  };
  users: {
    list: (clientId?: string | null) => Promise<any[]>;
  };
};
