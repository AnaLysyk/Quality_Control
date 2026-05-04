# Limpa todos os arquivos de log de desenvolvimento (dev-*.log) na raiz do projeto
Remove-Item -Path "dev-*.log" -Force -ErrorAction SilentlyContinue

# Limpa logs comuns de node/npm/yarn
Remove-Item -Path "*.log" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "npm-debug.log*" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "yarn-debug.log*" -Force -ErrorAction SilentlyContinue

Write-Host "Logs de desenvolvimento removidos."
