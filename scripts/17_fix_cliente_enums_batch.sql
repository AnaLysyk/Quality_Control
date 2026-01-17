-- scripts/17_fix_cliente_enums_batch.sql
-- Purpose: Batch copy for enum migration (for very large tables)
-- Usage: Set pk_column and batch_size as needed. Run before swap in main script.

DO $$
DECLARE
  pk_column text := 'id'; -- change if your PK is different
  batch_size int := 10000; -- adjust batch size as needed
  min_id bigint;
  max_id bigint;
  cur_id bigint;
BEGIN
  SELECT min(id), max(id) INTO min_id, max_id FROM public.cliente;
  cur_id := min_id;
  WHILE cur_id <= max_id LOOP
    EXECUTE format(
      'UPDATE public.cliente SET integration_type_new = CASE
        WHEN integration_type::text = ANY (ARRAY[''none'',''qase'',''jira'']) THEN integration_type::text::cliente_integration_type
        ELSE ''none''::cliente_integration_type END,
      status_new = CASE
        WHEN status::text = ANY (ARRAY[''active'',''inactive'']) THEN status::text::cliente_status_type
        ELSE ''active''::cliente_status_type END
      WHERE %I >= %s AND %I < %s',
      pk_column, cur_id, pk_column, cur_id + batch_size
    );
    cur_id := cur_id + batch_size;
  END LOOP;
END
$$;
