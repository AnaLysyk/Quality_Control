import { Body, Controller, HttpException, HttpStatus, Post, Res } from "@nestjs/common";
import { Response } from "express";
import {
  AuthCookieLoginResponseSchema,
  AuthLoginRequestSchema,
} from "../../../packages/contracts/src/auth";
import { ErrorResponseSchema } from "../../../packages/contracts/src/errors";
import { AuthService } from "./auth.service";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = AuthLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      this.authService.clearAuthCookie(res);
      throw new HttpException(
        ErrorResponseSchema.parse({ error: "Invalid payload" }),
        HttpStatus.BAD_REQUEST
      );
    }

    const { login, password } = parsed.data;
    const result = this.authService.validateCredentials(login, password);

    if (!result.ok) {
      this.authService.clearAuthCookie(res);
      throw new HttpException(
        ErrorResponseSchema.parse({ error: result.message }),
        result.status as HttpStatus
      );
    }

    this.authService.setAuthCookie(res, login);
    return AuthCookieLoginResponseSchema.parse({ ok: true });
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookie(res);
    return { ok: true };
  }
}
