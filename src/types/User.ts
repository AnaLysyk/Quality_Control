export type AppCompany = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  status: "active" | "inactive";
  roleAtCompany?: string | null;
};

export type AppUser = {
  id: string;
  email: string;
  name: string;
  avatarKey?: string | null;
  roleGlobal: "ADMIN" | "USER" | "CLIENT";
  role?: string | null;
  status: "active" | "inactive";
  company: AppCompany | null;
  isGlobalAdmin?: boolean | null;
  is_global_admin?: boolean | null;
  clientSlug?: string | null;
  companyResources?: unknown;
};
