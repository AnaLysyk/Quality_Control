import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as cookieParser from "cookie-parser";
import request = require("supertest");
import { AppModule } from "../src/app.module";

describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Backend modules currently require Supabase env vars at construction time.
    // Provide safe dummy values so this smoke test can run in CI/local without secrets.
    process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("GET /api/health retorna ok", () => {
    return request(app.getHttpServer())
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" });
  });
});
