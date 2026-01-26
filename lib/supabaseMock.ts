export const IS_PROD =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL === "1" ||
  typeof process.env.VERCEL_ENV === "string";

export const SUPABASE_MOCK_RAW = process.env.SUPABASE_MOCK === "true";
export const SUPABASE_MOCK = SUPABASE_MOCK_RAW && !IS_PROD;
