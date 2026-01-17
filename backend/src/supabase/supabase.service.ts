import { Injectable } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EnvironmentService } from "../config/environment.service";

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(private readonly env: EnvironmentService) {
    const url = this.env.getSupabaseUrl();
    const serviceKey = this.env.getSupabaseServiceRoleKey();
    if (!serviceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for backend Supabase access");
    }

    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }

  get supabase(): SupabaseClient {
    return this.client;
  }
}
