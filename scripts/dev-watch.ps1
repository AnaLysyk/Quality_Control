# dev-watch.ps1 — Inicia o servidor dev, salva logs e destaca erros em tempo real.
# Uso: .\scripts\dev-watch.ps1
# Opcional: .\scripts\dev-watch.ps1 -LogFile meu-log.txt

param(
    [string]$LogFile = "dev-live.log"
)

$ErrorPatterns = @(
    "error",
    "ECONNREFUSED",
    "ENOENT",
    "ChunkLoadError",
    "500",
    "Unhandled",
    "TypeError",
    "SyntaxError",
    "failed to compile"
)

$WarnPatterns = @(
    "warn",
    "warning",
    "deprecated",
    "404",
    "FALLBACK"
)

$ErrorRegex   = ($ErrorPatterns | ForEach-Object { [regex]::Escape($_) }) -join "|"
$WarnRegex    = ($WarnPatterns  | ForEach-Object { [regex]::Escape($_) }) -join "|"

Write-Host ""
Write-Host "==> dev-watch  |  log: $LogFile" -ForegroundColor Cyan
Write-Host "    Ctrl+C para parar." -ForegroundColor DarkGray
Write-Host ""

# Limpa log anterior se existir
if (Test-Path $LogFile) { Remove-Item $LogFile -Force }

$npm = if ($IsWindows -or $env:OS -match "Windows") { "npm.cmd" } else { "npm" }

& $npm run dev 2>&1 | ForEach-Object {
    $line = $_

    # Grava no arquivo de log
    Add-Content -Path $LogFile -Value $line

    # Coloriza a saída
    if ($line -match $ErrorRegex) {
        Write-Host $line -ForegroundColor Red
    } elseif ($line -match $WarnRegex) {
        Write-Host $line -ForegroundColor Yellow
    } elseif ($line -match "ready|compiled|success|started") {
        Write-Host $line -ForegroundColor Green
    } else {
        Write-Host $line
    }
}
