# self-pay.ps1 — Run from Windows PowerShell to trigger first x402 payment
# and get listed on the Coinbase Bazaar.
#
# Usage:
#   cd C:\Users\Micha\projects
#   .\self-pay.ps1
#
# Expects these files in C:\Users\Micha\Downloads\:
#   - cdp_api_key.json
#   - cdp_wallet_secret.txt

$ErrorActionPreference = "Stop"

$workDir = "$env:USERPROFILE\projects\x402-pay"
$wslScript = "\\wsl$\Ubuntu\home\mike\Projects\emdash\templates\professional\scripts\self-pay.ts"
$apiKeyFile = "$env:USERPROFILE\Downloads\cdp_api_key.json"
$walletFile = "$env:USERPROFILE\Downloads\cdp_wallet_secret.txt"

Write-Host "Setting up isolated Node project at $workDir" -ForegroundColor Cyan
if (!(Test-Path $workDir)) {
    New-Item -ItemType Directory -Path $workDir | Out-Null
}
Set-Location $workDir

# Minimal package.json with just what the script needs
$packageJson = @'
{
  "name": "x402-pay",
  "type": "module",
  "private": true,
  "dependencies": {
    "@coinbase/cdp-sdk": "^1.47.0",
    "@x402/core": "^2.9.0",
    "@x402/evm": "^2.9.0",
    "@x402/fetch": "^2.9.0",
    "bs58": "^6.0.0",
    "viem": "^2.47.0",
    "tsx": "^4.21.0"
  }
}
'@

[System.IO.File]::WriteAllText("$workDir\package.json", $packageJson, [System.Text.UTF8Encoding]::new($false))

Write-Host "Installing dependencies (this may take a minute)..." -ForegroundColor Cyan
npm install --silent

Write-Host "Copying self-pay script from WSL..." -ForegroundColor Cyan
Copy-Item $wslScript -Destination "self-pay.ts" -Force

Write-Host "Loading CDP credentials..." -ForegroundColor Cyan
$apiKey = Get-Content $apiKeyFile | ConvertFrom-Json
$env:CDP_API_KEY_ID = $apiKey.id
$env:CDP_API_KEY_SECRET = $apiKey.privateKey
$env:CDP_WALLET_SECRET = (Get-Content $walletFile -Raw).Trim()

Write-Host ""
Write-Host "Running self-pay against https://myepicportfolio.com/llms-full.txt" -ForegroundColor Green
Write-Host ""

npx tsx self-pay.ts
