import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { config } from "dotenv";
import * as cookieParser from "cookie-parser";
import { EnvironmentService } from "./config/environment.service";

config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.use(cookieParser());

  const env = app.get(EnvironmentService);
  const origin = env.getCorsOrigins();
  app.enableCors({
    origin,
    credentials: true,
  });

  const port = env.getPort();
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
