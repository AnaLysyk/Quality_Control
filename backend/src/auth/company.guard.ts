import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { AuthContext } from "./auth.service";
import { COMPANY_SCOPE_KEY, CompanyScopeOptions } from "./company.decorator";

type RequestWithUser = Request & { user?: AuthContext };

@Injectable()
export class CompanyScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<CompanyScopeOptions | undefined>(COMPANY_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException("Token de autenticacao ausente");
    }

    const allowGlobal = options.allowGlobalAdmin !== false;
    if (allowGlobal && user.isGlobalAdmin) {
      return true;
    }

    const companyId =
      typeof user.companyId === "string"
        ? user.companyId
        : typeof user.clientId === "string"
          ? user.clientId
          : null;

    if (!companyId) {
      throw new ForbiddenException("Usuario sem empresa vinculada");
    }

    const paramKey = options.param;
    const queryKey = options.query;
    const paramValue = paramKey && typeof req.params?.[paramKey] === "string" ? req.params[paramKey] : null;
    const queryValue = queryKey && typeof req.query?.[queryKey] === "string" ? (req.query[queryKey] as string) : null;
    const requested = paramValue || queryValue;

    if (requested && requested !== companyId) {
      throw new ForbiddenException("Acesso proibido a empresa");
    }

    return true;
  }
}
