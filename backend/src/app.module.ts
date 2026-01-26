import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { QaseModule } from "./qase/qase.module";
import { HealthModule } from "./health/health.module";
import { EnvironmentModule } from "./config/environment.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { S3Module } from "./s3/s3.module";

@Module({
  imports: [EnvironmentModule, SupabaseModule, S3Module, TenancyModule, AuthModule, QaseModule, HealthModule],
})
export class AppModule {}
