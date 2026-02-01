#!/bin/sh
# Alterna DATABASE_URL no .env.local para uso local ou Docker
# Uso: ./switch-db.sh local|docker

set -e

if [ ! -f .env.local ]; then
  echo ".env.local não encontrado."
  exit 1
fi

if [ "$1" = "local" ]; then
  sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL=postgres://docker2:docker2@127.0.0.1:5433/inorbit2?schema=public|' .env.local
  echo "DATABASE_URL ajustado para uso local (127.0.0.1:5433, schema=public)"
elif [ "$1" = "docker" ]; then
  sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL=postgres://docker2:docker2@postgres:5432/inorbit2?schema=public|' .env.local
  echo "DATABASE_URL ajustado para uso no Docker (postgres:5432, schema=public)"
else
  echo "Uso: $0 local|docker"
  exit 1
fi
