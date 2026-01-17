# Migração segura dos enums da tabela public.cliente

## Passos recomendados

1. Execute `scripts/17_fix_cliente_enums.sql` no staging.
   - O modo padrão mantém as colunas antigas (zero-downtime) para auditoria.
   - Se a tabela for muito grande, rode `scripts/17_fix_cliente_enums_batch.sql` antes de trocar as colunas.
2. Valide os efeitos:
   - Confirme os novos tipos:
     ```sql
     SELECT typname FROM pg_type WHERE typname IN ('cliente_integration_type','cliente_status_type');
     ```
   - Confirme `udt_name` e `default` das colunas:
     ```sql
     SELECT column_name, data_type, udt_name, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'cliente'
       AND column_name IN ('integration_type','status');
     ```
   - Verifique os valores auditados:
     ```sql
     SELECT * FROM public.cliente_enum_audit ORDER BY detected_at DESC LIMIT 100;
     ```
3. Após validar, remova manualmente os campos antigos se fizer sentido:
   ```sql
   ALTER TABLE public.cliente DROP COLUMN integration_type_old;
   ALTER TABLE public.cliente DROP COLUMN status_old;
   ```
4. Faça backup completo antes de aplicar em produção.

## Recomendações gerais

- Sempre execute os scripts em staging antes de promover para produção.
- Para tabelas com milhões de linhas, ajuste `batch_size` no script em lote.
- `cliente_enum_audit` mantém o histórico dos valores que foram mapeados.
