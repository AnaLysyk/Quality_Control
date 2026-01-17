import { Module } from "@nestjs/common";
import { QaseService } from "./qase.service";
import { QaseController } from "./qase.controller";
import { AuthModule } from "../auth/auth.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { CompanyIntegrationService } from "./company-integration.service";

@Module({
  imports: [AuthModule, SupabaseModule],
  providers: [QaseService, CompanyIntegrationService],
  controllers: [QaseController],
})
export class QaseModule {}
