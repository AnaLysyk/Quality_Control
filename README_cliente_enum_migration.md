# Migração segura dos enums em public.cliente

## Passos de execução

1. Execute scripts/17_fix_cliente_enums.sql no ambiente de staging.
   - Por padrão, usa modo zero-downtime (mantém colunas antigas para auditoria).
   - Para tabelas muito grandes, rode scripts/17_fix_cliente_enums_batch.sql antes do swap.
2. Valide o resultado:
   - Confirme existência dos tipos:
     SELECT typname FROM pg_type WHERE typname IN ('cliente_integration_type','cliente_status_type');
   - Confirme udt_name e default das colunas:
     SELECT column_name, data_type, udt_name, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'cliente'
       AND column_name IN ('integration_type','status');
   - Veja valores auditados/mapeados:
     SELECT * FROM public.cliente_enum_audit ORDER BY detected_at DESC LIMIT 100;
3. Após validação, remova manualmente as colunas antigas se desejar:
   ALTER TABLE public.cliente DROP COLUMN integration_type_old;
   ALTER TABLE public.cliente DROP COLUMN status_old;
4. Faça backup antes de rodar em produção.

## Recomendações
- Sempre teste em staging antes de promover para produção.
- Para tabelas com milhões de linhas, ajuste o batch_size no script de batch.
- A tabela cliente_enum_audit preserva histórico de valores mapeados.
