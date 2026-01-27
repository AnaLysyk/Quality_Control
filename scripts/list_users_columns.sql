-- Lista as colunas da tabela users no schema public
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users';
