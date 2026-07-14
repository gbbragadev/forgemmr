# Forge Nexus — server + browser (zero typing)
# Duplo clique ou: powershell -File scripts/start-maestro.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$env:MAESTRO_PORT = "8799"

Write-Host ""
Write-Host "  ◆  Forge Nexus — central operacional" -ForegroundColor Magenta
Write-Host "  $Root" -ForegroundColor DarkGray
Write-Host ""

# Ensure node
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "  Node.js não encontrado no PATH." -ForegroundColor Red
  pause
  exit 1
}

Write-Host "  Abrindo a central segura em http://127.0.0.1:8799" -ForegroundColor Cyan
& node "$Root\maestro\supervisor.mjs"
if ($LASTEXITCODE -ne 0) {
  Write-Host "  O Forge Nexus não abriu. A mensagem acima explica o bloqueio." -ForegroundColor Red
  pause
  exit $LASTEXITCODE
}
