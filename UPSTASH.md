Upstash (Upstash Redis) — configuração rápida

Resumo
- Este projeto pode usar Upstash (Redis REST) para persistir os arquivos JSON na nuvem.
- Quando `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` estiverem setados, a store passa a preferir KV via Upstash. Caso contrário, continua usando `data/*.json` local.

Passos para configurar Upstash (Upstash for Redis)
1. Crie uma conta em https://upstash.com/ e crie uma instância Redis.
2. No painel da instância, copie a REST URL (ex: `https://<id>.upstash.io`) e o REST token.
3. No Vercel (ou outro host), defina as variáveis de ambiente do projeto:
   - `UPSTASH_REDIS_REST_URL` → a URL da sua instância Upstash (sem pérfils adicionais)
   - `UPSTASH_REDIS_REST_TOKEN` → token REST do Upstash

Migração de dados locais para Upstash
- Um script auxiliar `tmp/migrate_to_upstash.js` foi adicionado. Exemplo de uso local:

```bash
# no terminal (local) exporte as variáveis e execute
export UPSTASH_REDIS_REST_URL="https://<id>.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="<token>"
node tmp/migrate_to_upstash.js
```

- O script fará `SET` no Upstash para cada arquivo `data/*.json`. A chave será o nome do arquivo sem `.json`.

Notas de segurança
- Não comite seus tokens em git. Configure-os apenas como segredos no Vercel/CI.
- Em produção, recomendamos usar as features de ACL/roles do Upstash se necessário.

Como reverter
- Se quiser reverter para a store local, remova as variáveis `UPSTASH_REDIS_REST_URL`/`TOKEN` do ambiente.

Perguntas frequentes
- O script faz backup local primeiro? Não — faça um backup do diretório `data/` antes de migrar.
- O script mantém o mesmo formato JSON.

