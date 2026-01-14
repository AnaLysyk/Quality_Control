import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { QaseModule } from "./qase/qase.module";
import { HealthModule } from "./health/health.module";
import { EnvironmentModule } from "./config/environment.module";

@Module({
  imports: [EnvironmentModule, AuthModule, QaseModule, HealthModule],
})
export class AppModule {}
