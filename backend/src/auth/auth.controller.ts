import { Controller, HttpException, HttpStatus, Post } from "@nestjs/common";
import { AuthCookieLoginResponseSchema } from "../../../packages/contracts/src/auth";
import { ErrorResponseSchema } from "../../../packages/contracts/src/errors";

@Controller()
export class AuthController {
  @Post("login")
  login() {
    throw new HttpException(
      ErrorResponseSchema.parse({ error: "Login movido para Supabase (Bearer token). Use o frontend para autenticar." }),
      HttpStatus.GONE
    );
  }

  @Post("logout")
  logout() {
    return AuthCookieLoginResponseSchema.parse({ ok: true });
  }
}
