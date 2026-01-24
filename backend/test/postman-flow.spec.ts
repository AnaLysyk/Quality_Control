import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as cookieParser from "cookie-parser";
import * as request from "supertest";

import { HealthController } from "../src/health/health.controller";
import { AuthController } from "../src/auth/auth.controller";
import { QaseController } from "../src/qase/qase.controller";
import { AuthService } from "../src/auth/auth.service";
import { AuthGuard } from "../src/auth/auth.guard";
import { CompanyScopeGuard } from "../src/auth/company.guard";
import { RolesGuard } from "../src/auth/roles.guard";
import { EnvironmentService } from "../src/config/environment.service";
import { QaseService } from "../src/qase/qase.service";

describe("Postman flow (Health/Auth/RBAC)", () => {
  let app: INestApplication;
  let authToken = "";

  const mockAuthService = {
    extractToken: jest.fn((req: any) => {
      const header = req.headers?.authorization ?? req.headers?.Authorization;
      if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
        return header.slice("bearer ".length).trim();
      }
      return null;
    }),
    validateToken: jest.fn(async () => ({
      userId: "user-1",
      email: "ana.testing.company@gmail.com",
      role: "client_admin",
      clientId: "company-1",
      companyId: "company-1",
      isGlobalAdmin: false,
      raw: { app_metadata: {}, user_metadata: {} },
    })),
    loginWithPassword: jest.fn(async (login: string) => ({
      user: { id: "user-1", email: login, user_metadata: {} },
      session: { access_token: "test-token", token_type: "bearer", expires_in: 3600 },
    })),
  };

  const mockEnv = {
    getAuthCookieName: () => "auth_token",
    isProduction: () => false,
    getQaseDefaultProject: () => "DEMO",
  };

  const mockQaseService = {
    createCountryInSupabase: jest.fn(async (name: string) => ({ id: 1, name })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController, AuthController, QaseController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: EnvironmentService, useValue: mockEnv },
        { provide: QaseService, useValue: mockQaseService },
        AuthGuard,
        CompanyScopeGuard,
        RolesGuard,
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health", async () => {
    const res = await request(app.getHttpServer()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("POST /api/auth/login", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "ana.testing.company@gmail.com", password: "secret" });

    expect([200, 201]).toContain(res.status);
    authToken = res.body?.session?.access_token ?? "";
    expect(authToken).toBe("test-token");
  });

  it("GET /api/auth/me", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.user).toBeTruthy();
    expect(res.body.user.clientId).toBe("company-1");
  });

  it("POST /api/countries (admin)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/countries")
      .query({ companyId: "company-1" })
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name: "Brazil" });

    expect([200, 201]).toContain(res.status);
    expect(res.body).toEqual({ id: 1, name: "Brazil" });
  });

  it("POST /api/auth/logout", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${authToken}`);

    expect([200, 201]).toContain(res.status);
  });
});
