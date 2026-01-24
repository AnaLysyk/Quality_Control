import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { CompanyScopeGuard } from "./company.guard";
import { RolesGuard } from "./roles.guard";
import { SupabaseModule } from "../supabase/supabase.module";
import { TenancyModule } from "../tenancy/tenancy.module";

@Module({
  imports: [SupabaseModule, TenancyModule],
  providers: [AuthService, AuthGuard, CompanyScopeGuard, RolesGuard],
  controllers: [AuthController],
  exports: [AuthGuard, AuthService, CompanyScopeGuard, RolesGuard],
})
export class AuthModule {}
