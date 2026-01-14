import { z } from "zod";

const LoginIdentifierSchema = z.string().trim().min(1).max(255);

export const AuthLoginRequestSchema = z
  .object({
    email: LoginIdentifierSchema.optional(),
    user: LoginIdentifierSchema.optional(),
    password: z.string().min(1).max(128),
  })
  .strip()
  .refine((data) => Boolean(data.email || data.user), {
    message: "login identifier is required",
  })
  .transform((data) => ({
    login: data.email ?? data.user ?? "",
    password: data.password,
  }));

export type AuthLoginRequestInput = z.input<typeof AuthLoginRequestSchema>;
export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>;

export const AuthSessionSchema = z
  .object({
    access_token: z.string().min(1),
    token_type: z.string().min(1),
    expires_in: z.number().int().min(1),
  })
  .strip();

export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const AuthSessionUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
  })
  .strip();

export type AuthSessionUser = z.infer<typeof AuthSessionUserSchema>;

export const AuthUserMetadataSchema = z
  .object({
    full_name: z.string().optional().nullable(),
  })
  .passthrough();

export type AuthUserMetadata = z.infer<typeof AuthUserMetadataSchema>;

export const AuthSupabaseUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().optional().nullable(),
    user_metadata: AuthUserMetadataSchema.optional().nullable(),
  })
  .passthrough();

export type AuthSupabaseUser = z.infer<typeof AuthSupabaseUserSchema>;

export const AuthLoginResponseSchema = z
  .object({
    user: AuthSupabaseUserSchema,
    session: AuthSessionSchema,
  })
  .strip();

export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>;

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
    avatarUrl: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    clientId: z.string().optional().nullable(),
    clientSlug: z.string().optional().nullable(),
    defaultClientSlug: z.string().optional().nullable(),
    clientSlugs: z.array(z.string().min(1)).optional(),
    isGlobalAdmin: z.boolean().optional(),
    is_global_admin: z.boolean().optional(),
  })
  .passthrough();

export type AuthUser = z.infer<typeof AuthUserSchema>;

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
    error: AuthMeErrorSchema.optional().nullable(),
  })
  .strip();

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
