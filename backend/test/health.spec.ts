import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Health (e2e)", () => {
  let app: INestApplication;

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

  it("GET /api/health retorna ok", () => {
    return request(app.getHttpServer())
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" });
  });
});
