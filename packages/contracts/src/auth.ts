import { z } from "zod";

const LoginIdentifierSchema = z.string().trim().min(1).max(255);

export const AuthLoginRequestSchema = z
  .object({
    login: LoginIdentifierSchema.optional(),
    email: LoginIdentifierSchema.optional(),
    user: LoginIdentifierSchema.optional(),
    password: z.string().min(1).max(128),
  })
  .strip()
  .refine((data) => Boolean(data.login || data.email || data.user), {
    message: "login identifier is required",
  })
  .transform((data) => ({
    login: data.login ?? data.email ?? data.user ?? "",
    password: data.password,
  }));

export type AuthLoginRequestInput = z.input<typeof AuthLoginRequestSchema>;
export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>;

export const AuthSessionUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
  })
  .strip();

export type AuthSessionUser = z.infer<typeof AuthSessionUserSchema>;

export const AuthCookieLoginResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .strip();

export type AuthCookieLoginResponse = z.infer<typeof AuthCookieLoginResponseSchema>;

export const AuthUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    user: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    fullName: z.string().optional().nullable(),
    avatarKey: z.string().optional().nullable(),
    avatarUrl: z.string().optional().nullable(),
    active: z.boolean().optional(),
    status: z.string().optional().nullable(),
    jobTitle: z.string().optional().nullable(),
    job_title: z.string().optional().nullable(),
    linkedinUrl: z.string().optional().nullable(),
    linkedin_url: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    globalRole: z.string().optional().nullable(),
    companyRole: z.string().optional().nullable(),
    capabilities: z.array(z.string().min(1)).optional(),
    permissions: z.record(z.string(), z.array(z.string().min(1))).optional(),
    permissionRole: z.string().optional().nullable(),
    userOrigin: z.string().optional().nullable(),
    user_origin: z.string().optional().nullable(),
    clientId: z.string().optional().nullable(),
    clientSlug: z.string().optional().nullable(),
    defaultClientSlug: z.string().optional().nullable(),
    clientSlugs: z.array(z.string().min(1)).optional(),
    isGlobalAdmin: z.boolean().optional(),
    is_global_admin: z.boolean().optional(),
  })
  .passthrough();

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthCompanySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    role: z.string().min(1),
    active: z.boolean().optional(),
    createdAt: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    companyRole: z.string().optional().nullable(),
    capabilities: z.array(z.string().min(1)).optional(),
  })
  .strip();

export type AuthCompany = z.infer<typeof AuthCompanySchema>;

export const AuthMeErrorSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
    message: z.string().optional().nullable(),
  })
  .strip();

export type AuthMeError = z.infer<typeof AuthMeErrorSchema>;

export const AuthMeResponseSchema = z
  .object({
    user: AuthUserSchema.nullable(),
    companies: z.array(AuthCompanySchema).optional(),
    error: AuthMeErrorSchema.optional().nullable(),
  })
  .strip();

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
