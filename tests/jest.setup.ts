// For tests, default to using the test-provided supabase mocks (not the built-in SUPABASE_MOCK path)
// Default to using the internal SUPABASE_MOCK for simple mock flows in tests
// Some tests rely on the built-in mock flow (SUPABASE_MOCK). Default to
// enabling it so legacy mock-based tests (e.g., login.mock.test) work.
// Individual tests that mock the `@/lib/supabaseServer` module will still
// take precedence because route handlers check for that mock.
// Default tests to use their own jest mocks for Supabase behavior.
process.env.SUPABASE_MOCK = process.env.SUPABASE_MOCK ?? "false";

// Provide dummy Supabase env vars to avoid runtime errors when clients are created
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:9999";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-role-key";

// JWT auth (used when SUPABASE_DISABLED=true in specific tests and in future migration)
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";
