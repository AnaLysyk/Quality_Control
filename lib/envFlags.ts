export function isSupabaseDisabled(): boolean {
  return process.env.SUPABASE_DISABLED === "true";
}

export function isProdLike(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    typeof process.env.VERCEL_ENV === "string"
  );
}
