import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { EnvironmentService } from "../config/environment.service";

export type AuthContext = {
  userId: string;
  email?: string;
  role?: string;
  clientId?: string;
  raw: Record<string, unknown>;
};

type SupabaseUserLike = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

type SupabaseAuthSessionLike = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type SupabaseClientLike = ReturnType<typeof createClient>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly supabaseAnon: SupabaseClientLike;
  private readonly supabaseService: SupabaseClientLike | null;
  private readonly jwtSecret: string | null;

  constructor(private readonly env: EnvironmentService) {
    const supabaseUrl = this.env.getSupabaseUrl();
    this.supabaseAnon = createClient(supabaseUrl, this.env.getSupabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const serviceKey = this.env.getSupabaseServiceRoleKey();
    this.supabaseService = serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

    this.jwtSecret = this.env.getJwtSecretOptional();
  }

  private tryValidateAppJwt(token: string): AuthContext | null {
    const secret = this.jwtSecret;
    if (!secret) return null;

    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
        sub?: unknown;
        email?: unknown;
        isGlobalAdmin?: unknown;
        role?: unknown;
        clientId?: unknown;
        client_id?: unknown;
      };

      const userId = typeof payload.sub === "string" ? payload.sub : null;
      if (!userId) return null;

      const email = typeof payload.email === "string" ? payload.email : undefined;
      const isGlobalAdmin = payload.isGlobalAdmin === true;
      const role = typeof payload.role === "string" ? payload.role : isGlobalAdmin ? "global_admin" : "user";
      const clientId =
        typeof payload.clientId === "string" ? payload.clientId : typeof payload.client_id === "string" ? payload.client_id : undefined;

      return {
        userId,
        email,
        role,
        clientId,
        raw: payload as unknown as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  extractToken(req: Request): string | null {
    const headerAuth = (req.headers?.authorization || req.headers?.Authorization) as string | undefined;
    if (headerAuth && typeof headerAuth === "string" && headerAuth.toLowerCase().startsWith("bearer ")) {
      return headerAuth.slice("bearer ".length).trim();
    }

    const cookieToken =
      (req.cookies?.["auth_token"] as string | undefined) ||
      (req.cookies?.["sb-access-token"] as string | undefined) ||
      (req.cookies?.["access_token"] as string | undefined);
    if (cookieToken) return cookieToken;

    const queryToken = typeof req.query?.token === "string" ? (req.query.token as string) : null;
    return queryToken || null;
  }

  private toAuthContext(user: SupabaseUserLike): AuthContext {
    const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
    const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;

    const role =
      (appMetadata.role as string | undefined) ||
      (userMetadata.role as string | undefined) ||
      "user";

    const clientId =
      (appMetadata.client_id as string | undefined) ||
      (userMetadata.client_id as string | undefined) ||
      undefined;

    return {
      userId: user.id,
      email: user.email ?? undefined,
      role,
      clientId,
      raw: {
        id: user.id,
        email: user.email ?? null,
        app_metadata: appMetadata,
        user_metadata: userMetadata,
      },
    };
  }

  async validateToken(token: string): Promise<AuthContext> {
    // 1) Prefer Supabase validation when service role is configured.
    if (this.supabaseService) {
      try {
        const { data, error } = await this.supabaseService.auth.getUser(token);
        if (!error && data?.user) {
          return this.toAuthContext(data.user as unknown as SupabaseUserLike);
        }
        if (error) {
          const message = typeof error.message === "string" ? error.message : "Unknown error";
          this.logger.debug(`Supabase token validation failed: ${message}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : JSON.stringify(err);
        this.logger.error(`Supabase token validation threw: ${message}`);
      }
    }

    // 2) Fallback: accept the app JWT used by the Next.js `/api/auth/login` route.
    const appJwt = this.tryValidateAppJwt(token);
    if (appJwt) return appJwt;

    throw new UnauthorizedException("Erro ao autenticar: token inválido ou expirado");
  }

  async loginWithPassword(login: string, password: string): Promise<{ user: SupabaseUserLike; session: SupabaseAuthSessionLike }> {
    try {
      const { data, error } = await this.supabaseAnon.auth.signInWithPassword({ email: login, password });
      if (error || !data?.session || !data?.user) {
        const reason = typeof error?.message === "string" ? error.message : "credenciais inválidas";
        throw new UnauthorizedException(`Erro ao autenticar: ${reason}`);
      }

      return {
        user: data.user as unknown as SupabaseUserLike,
        session: {
          access_token: data.session.access_token,
          token_type: data.session.token_type,
          expires_in: data.session.expires_in,
        },
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      const message = err instanceof Error ? err.message : "Erro inesperado";
      this.logger.error(`Supabase password login failed: ${message}`);
      throw new UnauthorizedException("Erro ao autenticar: falha inesperada");
    }
  }
}
