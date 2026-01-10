// Default to non-mock supabase during tests; individual tests can enable it
process.env.SUPABASE_MOCK = process.env.SUPABASE_MOCK ?? "false";
