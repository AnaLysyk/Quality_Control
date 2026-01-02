import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { config } from "dotenv";
import * as cookieParser from "cookie-parser";

config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.use(cookieParser());

  const originList =
    process.env.CORS_ORIGIN?.split(",")
      .map((v) => v.trim())
      .filter(Boolean) || [];
  const origin = originList.length > 0 ? originList : true;
  app.enableCors({
    origin,
    credentials: true,
  });

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
