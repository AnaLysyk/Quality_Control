import { Body, Controller, HttpException, HttpStatus, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "./auth.service";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(
    @Body("user") user: string,
    @Body("password") password: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = this.authService.validateCredentials(user, password);

    if (!result.ok) {
      this.authService.clearAuthCookie(res);
      throw new HttpException(result.message, result.status as HttpStatus);
    }

    this.authService.setAuthCookie(res, user);
    return { ok: true };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookie(res);
    return { ok: true };
  }
}
