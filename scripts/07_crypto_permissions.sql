-- 07_crypto_permissions.sql
-- Ajusta privilégios para funções de criptografia e colunas cifradas.
-- Usa o role padrão "service_role" (troque pelo nome do seu role de backend se diferente).

-- Funções helper: remover EXECUTE de PUBLIC e conceder apenas a postgres/service_role
REVOKE EXECUTE ON FUNCTION public.qase_encrypt(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qase_decrypt(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qase_encrypt(text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.qase_decrypt(bytea) TO postgres, service_role;

-- Colunas cifradas: revogar SELECT da coluna e conceder apenas a postgres/service_role
REVOKE SELECT (qase_token_cipher) ON public.company_integrations FROM PUBLIC;
GRANT SELECT (qase_token_cipher) ON public.company_integrations TO postgres, service_role;

REVOKE SELECT (qase_project_code_cipher) ON public.cliente FROM PUBLIC;
GRANT SELECT (qase_project_code_cipher) ON public.cliente TO postgres, service_role;

-- Verificação sugerida:
-- SELECT proname, proacl FROM pg_proc WHERE proname IN ('qase_encrypt','qase_decrypt');
-- SELECT grantee, privilege_type FROM information_schema.column_privileges
--  WHERE table_name IN ('company_integrations','cliente')
--    AND column_name IN ('qase_token_cipher','qase_project_code_cipher');

-- Rollback (se necessário):
-- GRANT EXECUTE ON FUNCTION public.qase_encrypt(text) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.qase_decrypt(bytea) TO PUBLIC;
-- GRANT SELECT (qase_token_cipher) ON public.company_integrations TO PUBLIC;
-- GRANT SELECT (qase_project_code_cipher) ON public.cliente TO PUBLIC;
