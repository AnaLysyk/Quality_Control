-- 06_encrypt_company_integrations.sql
-- Migra access_token em texto para qase_token_cipher (bytea) usando qase_encrypt e limpa a coluna plaintext.
-- Requer: funções public.qase_encrypt / public.qase_decrypt já criadas (pgcrypto) e GUC app.qase_passphrase definida na sessão.
-- Execução recomendada: staging primeiro, depois produção (com backup).

-- Defina a passphrase na sessão ANTES de rodar este arquivo (não é armazenada aqui).
-- Exemplo: SET LOCAL app.qase_passphrase = 'SUA_PASSPHRASE_SEGURA';

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT id, access_token
    FROM public.company_integrations
    WHERE access_token IS NOT NULL
  LOOP
    UPDATE public.company_integrations
    SET qase_token_cipher = public.qase_encrypt(rec.access_token),
        access_token = NULL
    WHERE id = rec.id;
  END LOOP;
END$$;

-- Verificações pós-migração (rode manualmente após este script):
-- SELECT count(*) AS cipher_count FROM public.company_integrations WHERE qase_token_cipher IS NOT NULL;
-- SELECT count(*) AS plain_count  FROM public.company_integrations WHERE access_token IS NOT NULL;
-- SET LOCAL app.qase_passphrase = 'SUA_PASSPHRASE_SEGURA';
-- SELECT id, public.qase_decrypt(qase_token_cipher) AS token_plain
--   FROM public.company_integrations
--  WHERE qase_token_cipher IS NOT NULL
--  LIMIT 5;

-- Rollback manual (se necessário e antes de limpar backups):
-- Não há rollback automático. Use backup do banco ou copie de volta a partir de dump se precisar reverter.

