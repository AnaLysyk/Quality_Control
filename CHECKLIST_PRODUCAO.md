# Checklist de Produção: painel-qa

1. Copie este arquivo para `.env.production` na raiz do projeto.
2. Preencha os valores reais do Supabase e outros serviços:

NEXT_PUBLIC_SUPABASE_URL=coloque_aqui_sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=coloque_aqui_sua_anon_key
SUPABASE_URL=coloque_aqui_sua_url_do_supabase
SUPABASE_ANON_KEY=coloque_aqui_sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=coloque_aqui_sua_service_role_key
# SERVICE_KEY=coloque_aqui_se_necessário

3. No Vercel, acesse Settings > Environment Variables e cadastre as mesmas variáveis do .env.production.
4. Faça o deploy do frontend (Vercel) e backend (separado, se aplicável).
5. Confirme que as variáveis estão corretas no painel do Vercel/Supabase.
6. Rode os testes de produção para validar o ambiente.

Se precisar de script de validação ou seed de dados, solicite!
