export type FavoriteType =
  | "page"
  | "module"
  | "company"
  | "dashboard"
  | "test-case"
  | "test-plan"
  | "run"
  | "ticket"
  | "conversation"
  | "action";

export type FavoriteContext = {
  companyId?: string;
  companySlug?: string;
  applicationId?: string;
  moduleId?: string;
  entityId?: string;
};

export type FavoriteItem = {
  id: string;
  userId: string;
  label: string;
  description?: string;
  href: string;
  iconKey?: string;
  type: FavoriteType;
  context?: FavoriteContext;
  order?: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateFavoriteInput = {
  label: string;
  description?: string;
  href: string;
  iconKey?: string;
  type: FavoriteType;
  context?: FavoriteContext;
};
