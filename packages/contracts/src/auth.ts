import { z } from "zod";

/**
 * Identificador de login: login, email ou user.
 */
const LoginIdentifierSchema = z.string().trim().min(1).max(255);

/**
 * Schema para requisição de login.
 */
export const AuthLoginRequestSchema = z
  .object({
    login: LoginIdentifierSchema.optional(),
    email: z.string().email().optional(),
    user: LoginIdentifierSchema.optional(),
    password: z.string().min(1).max(128),
  })
  .strip()
  .refine((data) => Boolean(data.login || data.email || data.user), {
    message: "Identificador de login é obrigatório",
  })
  .transform((data) => ({
    login: data.login ?? data.email ?? data.user ?? "",
    password: data.password,
  }));

export type AuthLoginRequestInput = z.input<typeof AuthLoginRequestSchema>;
export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>;

/**
 * Usuário da sessão autenticada.
 */
export const AuthSessionUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email().optional().nullable(),
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

/**
 * Usuário autenticado (completo).
 */
export const AuthUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email().optional().nullable(),
    name: z.string().optional().nullable(),
    avatarUrl: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    globalRole: z.string().optional().nullable(),
    companyRole: z.string().optional().nullable(),
    capabilities: z.array(z.string().min(1)).optional(),
    clientId: z.string().optional().nullable(),
    clientSlug: z.string().optional().nullable(),
    defaultClientSlug: z.string().optional().nullable(),
    clientSlugs: z.array(z.string().min(1)).optional(),
    isGlobalAdmin: z.boolean().optional(),
    isGlobalAdminLegacy: z.boolean().optional(),
  })
  .passthrough();

export type AuthUser = z.infer<typeof AuthUserSchema>;

/**
 * Empresa do usuário autenticado.
 */
export const AuthCompanySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    role: z.string().min(1),
    active: z.boolean().optional(),
    createdAt: z.string().optional().nullable(),
    companyRole: z.string().optional().nullable(),
    capabilities: z.array(z.string().min(1)).optional(),
  })
  .strip();

export type AuthCompany = z.infer<typeof AuthCompanySchema>;

/**
 * Erro retornado pelo endpoint /me.
 */
export const AuthMeErrorSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
    message: z.string().optional().nullable(),
  })
  .strip();

export type AuthMeError = z.infer<typeof AuthMeErrorSchema>;

/**
 * Resposta do endpoint /me.
 */
export const AuthMeResponseSchema = z
  .object({
    user: AuthUserSchema.nullable(),
    companies: z.array(AuthCompanySchema).optional(),
    error: AuthMeErrorSchema.optional().nullable(),
  })
  .strip();

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
