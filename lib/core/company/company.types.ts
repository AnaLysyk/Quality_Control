export type CompanyAccess = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  role: "ADMIN" | "USER";
  linkActive: boolean;
};
