import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import * as cookieParser from "cookie-parser";
import * as request from "supertest";
import { config as loadEnv } from "dotenv";
import { AppModule } from "../src/app.module";

loadEnv();

const email = process.env.SMOKE_EMAIL || process.env.TEST_EMAIL || "";
const password = process.env.SMOKE_PASSWORD || process.env.TEST_PASSWORD || "";
const hasCreds = Boolean(email && password);

const describeReal = hasCreds ? describe : describe.skip;

describeReal("Postman flow (real env/Supabase)", () => {
  let app: INestApplication;
  let authToken = "";
  let companyId: string | null = null;
  let role: string | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
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
      .send({ email, password });

    expect([200, 201]).toContain(res.status);
    authToken = res.body?.session?.access_token ?? "";
    expect(authToken).toBeTruthy();
  });

  it("GET /api/auth/me", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.user).toBeTruthy();

    const user = res.body.user ?? {};
    companyId = user.companyId ?? user.clientId ?? null;
    role = typeof user.role === "string" ? user.role : null;
  });

  it("POST /api/countries (RBAC)", async () => {
    const req = request(app.getHttpServer())
      .post("/api/countries")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name: "Brazil" });

    const res = companyId ? await req.query({ companyId }) : await req;

    const allowedRoles = new Set(["client_admin", "admin", "global_admin"]);
    if (role && allowedRoles.has(role.toLowerCase())) {
      expect([200, 201]).toContain(res.status);
    } else {
      expect([401, 403]).toContain(res.status);
    }
  });

  it("POST /api/auth/logout", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${authToken}`);

    expect([200, 201]).toContain(res.status);
  });
});

// If credentials are missing, show a clear hint.
if (!hasCreds) {
  // eslint-disable-next-line no-console
  console.warn("Skipping real Postman flow tests. Set SMOKE_EMAIL and SMOKE_PASSWORD to enable.");
}
