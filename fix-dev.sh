#!/usr/bin/env bash
set -euo pipefail

# Configuráveis
PROJECT_PATH="/mnt/c/Users/Testing Company/painel-qa"
ENV_FILE="$PROJECT_PATH/.env.local"
DEV_URL="http://localhost:3000"
PROXY=""
LOG_FILE="$(pwd)/fix-dev.log"

# Parse argumentos: --proxy "http://user:pass@host:port"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --proxy)
      PROXY="$2"
      shift 2
      ;;
    *)
      echo "Uso: $0 [--proxy \"http://user:pass@host:port\"]"
      exit 1
      ;;
  esac
done

echo ">> Log em: $LOG_FILE"
exec > >(tee "$LOG_FILE") 2>&1

echo ">> Ativando SUPABASE_MOCK=true em $ENV_FILE"
if [[ -f "$ENV_FILE" ]]; then
  if grep -qE '^SUPABASE_MOCK=' "$ENV_FILE"; then
    perl -pi -e 's/^SUPABASE_MOCK=.*/SUPABASE_MOCK=true/' "$ENV_FILE"
  else
    printf "\nSUPABASE_MOCK=true\n" >> "$ENV_FILE"
  fi
else
  mkdir -p "$(dirname "$ENV_FILE")"
  printf "SUPABASE_MOCK=true\n" > "$ENV_FILE"
fi

if [[ -n "$PROXY" ]]; then
  echo ">> Definindo proxy: $PROXY"
  export HTTP_PROXY="$PROXY"
  export HTTPS_PROXY="$PROXY"
else
  echo ">> Sem proxy definido. Para usar proxy: --proxy \"http://proxy:port\""
fi

echo ">> Limpando cache DNS (se disponível)"
if command -v resolvectl >/dev/null 2>&1; then
  resolvectl flush-caches || true
elif command -v systemd-resolve >/dev/null 2>&1; then
  systemd-resolve --flush-caches || true
fi

echo ">> Teste DNS"
nslookup rmsivghnipznnluyekx.supabase.co || true

echo ">> Teste HTTP/TLS (curl -v)"
curl -v https://rmsivghnipznnluyekx.supabase.co || true

echo ">> Lembrete: iniciar dev server em outro terminal:"
echo "   cd \"$PROJECT_PATH\""
echo "   npm run dev"
echo

echo ">> Teste de login (mock) via curl"
curl -i -X POST "$DEV_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  --data '{"email":"ana.testing.company@gmail.com","password":"griaule4096PD$"}' || true

echo ">> Pronto. Para voltar ao Supabase real depois, defina SUPABASE_MOCK=false em $ENV_FILE e reinicie o dev server."
