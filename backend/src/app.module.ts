import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { QaseModule } from "./qase/qase.module";
import { HealthModule } from "./health/health.module";
import { EnvironmentModule } from "./config/environment.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { TenancyModule } from "./tenancy/tenancy.module";

@Module({
  imports: [EnvironmentModule, SupabaseModule, TenancyModule, AuthModule, QaseModule, HealthModule],
})
export class AppModule {}
