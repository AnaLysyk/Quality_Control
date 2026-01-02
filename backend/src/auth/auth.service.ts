import { Injectable } from "@nestjs/common";
import { Response } from "express";

const COOKIE_NAME = "auth";

@Injectable()
export class AuthService {
  getAdminCredentials() {
    const adminUser = process.env.ADMIN_USER || "";
    const adminPassword = process.env.ADMIN_PASSWORD || "";
    return { adminUser, adminPassword };
  }

  validateCredentials(user?: string, password?: string) {
    const { adminUser, adminPassword } = this.getAdminCredentials();

    if (!adminUser || !adminPassword) {
      return { ok: false, status: 500, message: "Credenciais de admin não configuradas" };
    }

    if (!user || !password) {
      return { ok: false, status: 400, message: "Login e senha são obrigatórios" };
    }

    if (user !== adminUser || password !== adminPassword) {
      return { ok: false, status: 401, message: "Credenciais inválidas" };
    }

    return { ok: true, status: 200 };
  }

  setAuthCookie(res: Response, value: string) {
    res.cookie(COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  clearAuthCookie(res: Response) {
    res.cookie(COOKIE_NAME, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  isAuthenticated(cookieValue?: string | null) {
    const { adminUser } = this.getAdminCredentials();
    return Boolean(adminUser && cookieValue === adminUser);
  }
}
