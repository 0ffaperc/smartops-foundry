$ErrorActionPreference = "Stop"

Write-Host "LifeOS V2 launcher" -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed. Install Node.js LTS first, then run this script again." -ForegroundColor Red
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm is not installed. Reinstall Node.js LTS with npm enabled." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm install
}

Write-Host "Starting LifeOS V2 desktop app..." -ForegroundColor Green
npm run electron
