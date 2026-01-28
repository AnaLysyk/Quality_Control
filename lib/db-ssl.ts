// Força o Node a aceitar certificados self-signed do Supabase Pooler em produção
if (process.env.NODE_ENV === "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
