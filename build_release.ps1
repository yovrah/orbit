# Orbit — one-shot release builder.
# Builds the frontend, packages the agent into a standalone Windows app with
# PyInstaller, and zips it as Orbit-windows.zip for a GitHub Release.
#
#   powershell -ExecutionPolicy Bypass -File build_release.ps1
#
# Requires: Node.js + npm, and the agent venv with pyinstaller installed
# (venv\Scripts\pip install -r agent\requirements.txt pyinstaller).

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Agent = Join-Path $Root 'agent'
$Venv = Join-Path $Agent 'venv\Scripts'

Write-Host '==> [1/3] Building frontend...' -ForegroundColor Cyan
Push-Location (Join-Path $Root 'frontend')
npm install
npm run build
Pop-Location

Write-Host '==> [2/3] Packaging agent with PyInstaller...' -ForegroundColor Cyan
Push-Location $Agent
& (Join-Path $Venv 'pyinstaller.exe') --clean --noconfirm orbit.spec
Pop-Location

Write-Host '==> [3/3] Zipping release...' -ForegroundColor Cyan
$DistApp = Join-Path $Agent 'dist\Orbit'
$Zip = Join-Path $Root 'Orbit-windows.zip'
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path (Join-Path $DistApp '*') -DestinationPath $Zip
$SizeMB = [math]::Round((Get-Item $Zip).Length / 1MB, 1)

Write-Host ''
Write-Host "[OK] Release built: $Zip ($SizeMB MB)" -ForegroundColor Green
Write-Host "     App folder:    $DistApp"
Write-Host '     Users unzip and double-click Orbit.exe. No Python/Node needed.'
