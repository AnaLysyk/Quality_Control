import { Module } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { TenantService } from "./tenant.service";

@Module({
  imports: [SupabaseModule],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenancyModule {}
