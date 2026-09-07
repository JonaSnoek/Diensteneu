# Central Portal – Update für Windows (Entwicklung)
# Führt dieselben Schritte wie update.sh auf einem Windows-Rechner aus.
# Verwendung (in PowerShell im Projektordner):
#   powershell -ExecutionPolicy Bypass -File update.ps1
# oder direkt:
#   .\update.ps1
$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot

Write-Host ''
Write-Host '[1/4] Hole neuesten Stand von GitHub (Branch master)...' -ForegroundColor Green
git -C $ROOT pull --ff-only

if ($LASTEXITCODE -ne 0) { throw 'git pull fehlgeschlagen (z.B. lokale Änderungen). Bitte beheben und erneut versuchen.' }

Write-Host '[2/4] Aktualisiere Python-Abhängigkeiten...' -ForegroundColor Green
& "$ROOT\backend\venv\Scripts\python.exe" -m pip install -r "$ROOT\backend\requirements.txt" -q

if ($LASTEXITCODE -ne 0) { throw 'pip install fehlgeschlagen.' }

Write-Host '[3/4] Installiere Frontend-Abhängigkeiten und erstelle Build...' -ForegroundColor Green
Push-Location "$ROOT\frontend"
try {
    npm install --silent
    if ($LASTEXITCODE -ne 0) { throw 'npm install fehlgeschlagen.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'npm run build fehlgeschlagen.' }
} finally { Pop-Location }

Write-Host ''
Write-Host 'Update abgeschlossen.' -ForegroundColor Green
Write-Host 'Hinweise:'
Write-Host '  - Backend starten: cd backend\  .\venv\Scripts\uvicorn app.main:app --reload'
Write-Host '  - Migrationen laufen automatisch beim Start.'