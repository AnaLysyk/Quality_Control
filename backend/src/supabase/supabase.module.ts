import { Module } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";
import { EnvironmentModule } from "../config/environment.module";

@Module({
  imports: [EnvironmentModule],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
