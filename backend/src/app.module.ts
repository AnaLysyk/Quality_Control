import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { QaseModule } from "./qase/qase.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [AuthModule, QaseModule, HealthModule],
})
export class AppModule {}
