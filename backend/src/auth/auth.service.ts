import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import jwt from "jsonwebtoken";

export type AuthContext = {
  userId: string;
  email?: string;
  role?: string;
  clientId?: string;
  raw: jwt.JwtPayload;
};

type SupabaseJwtPayload = jwt.JwtPayload & {
  email?: string;
  role?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

@Injectable()
export class AuthService {
  private getJwtSecret() {
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_JWT_SIGNING_SECRET || "";
    if (!secret) {
      throw new UnauthorizedException("Missing SUPABASE_JWT_SECRET or SUPABASE_JWT_SIGNING_SECRET");
    }
    return secret;
  }

  extractToken(req: Request): string | null {
    const headerAuth = (req.headers?.authorization || req.headers?.Authorization) as string | undefined;
    if (headerAuth && typeof headerAuth === "string" && headerAuth.toLowerCase().startsWith("bearer ")) {
      return headerAuth.slice("bearer ".length).trim();
    }

    const cookieToken =
      (req.cookies?.["sb-access-token"] as string | undefined) || (req.cookies?.["access_token"] as string | undefined);
    if (cookieToken) return cookieToken;

    const queryToken = typeof req.query?.token === "string" ? (req.query.token as string) : null;
    return queryToken || null;
  }

  validateToken(token: string): AuthContext {
    try {
      const payload = jwt.verify(token, this.getJwtSecret()) as SupabaseJwtPayload;
      const userId = (payload.sub as string) || "";
      if (!userId) {
        throw new UnauthorizedException("Invalid token payload");
      }

      const role =
        payload.role ||
        (payload.app_metadata?.role as string | undefined) ||
        (payload.user_metadata?.role as string | undefined) ||
        "user";

      const clientId =
        (payload.app_metadata?.client_id as string | undefined) ||
        (payload.user_metadata?.client_id as string | undefined) ||
        ((payload as Record<string, unknown>)["client_id"] as string | undefined);

      return {
        userId,
        email: payload.email,
        role,
        clientId,
        raw: payload,
      };
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
