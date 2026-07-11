# Maestro HQ — server + browser (zero typing)
# Duplo clique ou: powershell -File scripts/start-maestro.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$MaestroPort = 8799
$Ui = "http://127.0.0.1:$MaestroPort/"

Write-Host ""
Write-Host "  🎼  Maestro HQ — Anime Forge" -ForegroundColor Magenta
Write-Host "  $Root" -ForegroundColor DarkGray
Write-Host ""

# Ensure node
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "  Node.js não encontrado no PATH." -ForegroundColor Red
  pause
  exit 1
}

# Start Maestro server if needed
$busy = Get-NetTCPConnection -LocalPort $MaestroPort -ErrorAction SilentlyContinue
if (-not $busy) {
  Write-Host "  → node maestro/server.mjs (porta $MaestroPort)" -ForegroundColor Cyan
  Start-Process -FilePath "node" -ArgumentList "maestro/server.mjs" -WorkingDirectory $Root -WindowStyle Minimized
  Start-Sleep -Seconds 2
} else {
  Write-Host "  ✓ Maestro já em :$MaestroPort" -ForegroundColor Green
}

Start-Process $Ui
Write-Host "  ✓ Aberto $Ui" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Clique preset: E2E teste · só Grok" -ForegroundColor White
Write-Host "  2. Clique RUN" -ForegroundColor White
Write-Host "  3. Acompanhe o log ao vivo" -ForegroundColor White
Write-Host ""
