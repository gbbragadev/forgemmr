@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale o Node.js 20 ou superior e tente novamente.
  pause
  exit /b 1
)

node "%~dp0maestro\supervisor.mjs"
if errorlevel 1 (
  echo.
  echo O Maestro nao abriu. Confira se outra aplicacao esta usando a porta 8799.
  pause
  exit /b 1
)

endlocal
