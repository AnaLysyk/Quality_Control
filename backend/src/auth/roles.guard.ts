import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { AuthContext } from "./auth.service";
import { ROLES_KEY } from "./roles.decorator";

type RequestWithUser = Request & { user?: AuthContext };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException("Token de autenticacao ausente");
    }

    if (user.isGlobalAdmin) {
      return true;
    }

    const role = typeof user.role === "string" ? user.role.toLowerCase() : "";
    const normalizedRequired = required.map((r) => r.toLowerCase());
    if (!role || !normalizedRequired.includes(role)) {
      throw new ForbiddenException("Permissao insuficiente");
    }

    return true;
  }
}
