import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { AuthContext, AuthService } from "./auth.service";

type RequestWithUser = Request & { user?: AuthContext };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.authService.extractToken(req);

    if (!token) {
      throw new UnauthorizedException("Missing auth token");
    }

    const auth = await this.authService.validateToken(token);
    req.user = auth;
    return true;
  }
}
