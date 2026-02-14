/**
 * Types and interface for backend data source abstraction.
 * Used to define contract for auth, company, and user operations.
 */
export type AuthLoginInput = { user: string; password: string };
/**
 * Result of a successful login operation.
 */
export type AuthLoginResult = { ok: true };

/**
 * User object returned by /me endpoint.
 */
export type MeUser = Record<string, unknown>;

/**
 * Result of the /me endpoint: user and companies.
 */
export type AuthMeResult = {
  user: MeUser;
  companies: Array<Record<string, unknown>>;
};

/**
 * Input for creating a company.
 */
export type CompanyCreateInput = {
  name?: string;
  company_name?: string;
  slug?: string;
};

/**
 * Interface for backend data source (API, mock, etc).
 * Defines contract for auth, company, and user operations.
 */
export type DataSource = {
  auth: {
    /** Login with user and password */
    login: (input: AuthLoginInput) => Promise<AuthLoginResult>;
    /** Get current user and companies */
    me: () => Promise<AuthMeResult>;
    /** Logout current user */
    logout: () => Promise<void>;
  };
  companies: {
    /** List all companies */
    list: () => Promise<Array<Record<string, unknown>>>;
    /** Create a new company */
    create: (input: CompanyCreateInput) => Promise<Record<string, unknown>>;
  };
  users: {
    /** List users, optionally filtered by clientId */
    list: (clientId?: string | null) => Promise<Array<Record<string, unknown>>>;
  };
};
