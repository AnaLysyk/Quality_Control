-- 05_crypto_policies.sql
-- Harden access to encrypted columns and crypto functions (idempotent)
-- Run after 04_audit_triggers.sql (staging first)

-- Ensure only service_role (and superuser) can call crypto helpers
REVOKE EXECUTE ON FUNCTION public.qase_encrypt(text) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.qase_decrypt(bytea) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.qase_encrypt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.qase_decrypt(bytea) TO service_role;

-- Optional: keep privileges explicit for postgres/superuser
GRANT EXECUTE ON FUNCTION public.qase_encrypt(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.qase_decrypt(bytea) TO postgres;

-- Column-level protections for cipher columns (prevents accidental SELECT by authenticated roles)
REVOKE SELECT (qase_token_cipher) ON public.company_integrations FROM PUBLIC, authenticated;
REVOKE SELECT (qase_project_code_cipher) ON public.cliente FROM PUBLIC, authenticated;
GRANT SELECT (qase_token_cipher) ON public.company_integrations TO service_role;
GRANT SELECT (qase_project_code_cipher) ON public.cliente TO service_role;

-- (company_integrations já tem políticas de SELECT bloqueando authenticated; estas revogações são um cinto e suspensório)

-- Verification
-- \df+ public.qase_encrypt
-- \df+ public.qase_decrypt
-- SELECT has_table_privilege('authenticated', 'public.company_integrations', 'SELECT');
-- SELECT has_column_privilege('authenticated', 'public.company_integrations', 'qase_token_cipher', 'SELECT');
-- SELECT has_column_privilege('authenticated', 'public.cliente', 'qase_project_code_cipher', 'SELECT');

-- Rollback
-- GRANT EXECUTE ON FUNCTION public.qase_encrypt(text) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.qase_decrypt(bytea) TO PUBLIC;
-- GRANT SELECT (qase_token_cipher) ON public.company_integrations TO PUBLIC, authenticated;
-- GRANT SELECT (qase_project_code_cipher) ON public.cliente TO PUBLIC, authenticated;
