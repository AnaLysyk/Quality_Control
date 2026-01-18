import { BadRequestException, Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  AuthCookieLoginResponseSchema,
  AuthLoginRequestSchema,
  AuthLoginResponseSchema,
  AuthMeResponseSchema,
} from "../../../packages/contracts/src/auth";
import { ErrorResponseSchema } from "../../../packages/contracts/src/errors";
import { AuthService } from "./auth.service";
import { EnvironmentService } from "../config/environment.service";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly env: EnvironmentService) {}

  private getCookieName() {
    return this.env.getAuthCookieName();
  }

  private setAuthCookie(res: Response, accessToken: string, expiresInSeconds: number) {
    res.cookie(this.getCookieName(), accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.env.isProduction(),
      path: "/",
      maxAge: Math.max(1, expiresInSeconds) * 1000,
    });
  }

  private clearAuthCookie(res: Response) {
    res.clearCookie(this.getCookieName(), {
      httpOnly: true,
      sameSite: "lax",
      secure: this.env.isProduction(),
      path: "/",
    });
  }

  @Post("auth/login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = AuthLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        ErrorResponseSchema.parse({ error: "Email/usuario e senha sao obrigatorios" }),
      );
    }

    const { login, password } = parsed.data;
    const { user, session } = await this.authService.loginWithPassword(login, password);

    // Default behavior: set cookie for browser flows.
    // If you want pure bearer-only, send `setCookie: false`.
    const setCookie = (body as { setCookie?: boolean } | null)?.setCookie;
    if (setCookie !== false) {
      this.setAuthCookie(res, session.access_token, session.expires_in);
    }

    return AuthLoginResponseSchema.parse({ user, session });
  }

  // Backwards compatible alias
  @Post("login")
  async loginLegacy(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.login(body, res);
  }

  @Get("auth/me")
  async me(@Req() req: Request) {
    const token = this.authService.extractToken(req);
    if (!token) {
    return AuthMeResponseSchema.parse({ user: null, companies: [] });
    }

    const ctx = await this.authService.validateToken(token);

    const raw = ctx.raw as Record<string, unknown>;
    const appMetadata = (raw.app_metadata ?? {}) as Record<string, unknown>;
    const userMetadata = (raw.user_metadata ?? {}) as Record<string, unknown>;
    const name = (userMetadata.full_name as string | undefined) || (userMetadata.name as string | undefined) || null;
    const avatarUrl = (userMetadata.avatar_url as string | undefined) || (userMetadata.avatarUrl as string | undefined) || null;

    const isGlobalAdmin =
      (appMetadata.is_global_admin as boolean | undefined) ||
      (userMetadata.is_global_admin as boolean | undefined) ||
      (appMetadata.isGlobalAdmin as boolean | undefined) ||
      (userMetadata.isGlobalAdmin as boolean | undefined) ||
      undefined;

    return AuthMeResponseSchema.parse({
      user: {
        id: ctx.userId,
        email: ctx.email ?? null,
        name,
        avatarUrl,
        role: ctx.role ?? null,
        clientId: ctx.clientId ?? null,
        isGlobalAdmin,
      },
      companies: [],
    });
  }

  // Backwards compatible alias
  @Get("me")
  async meLegacy(@Req() req: Request) {
    return this.me(req);
  }

  @Post("auth/logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookie(res);
    return AuthCookieLoginResponseSchema.parse({ ok: true });
  }

  // Backwards compatible alias
  @Post("logout")
  async logoutLegacy(@Res({ passthrough: true }) res: Response) {
    return this.logout(res);
  }
}
