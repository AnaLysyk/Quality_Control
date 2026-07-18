#!/bin/bash
# Limpa todos os arquivos de log de desenvolvimento (dev-*.log) na raiz do projeto
rm -f dev-*.log
# Limpa logs comuns de node/npm/yarn
rm -f *.log npm-debug.log* yarn-debug.log*
echo "Logs de desenvolvimento removidos."
