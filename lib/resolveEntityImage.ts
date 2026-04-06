export type ResolveEntityImageParams = {
  isCompanyContext?: boolean;
  companyLogoUrl?: string | null;
  userAvatarUrl?: string | null;
};

export function resolveEntityImage(params: ResolveEntityImageParams): string | null {
  if (params.isCompanyContext && params.companyLogoUrl) return params.companyLogoUrl;
  return params.userAvatarUrl ?? null;
}

export default resolveEntityImage;
