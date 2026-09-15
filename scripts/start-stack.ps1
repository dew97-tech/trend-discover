# Starts the long-running processes Trend Discover needs.
#
#   powershell -ExecutionPolicy Bypass -File scripts/start-stack.ps1
#
# The daily workflow (pipeline:run at 01:00) is triggered by schedule:work and
# executed by queue:work — no manual job commands required.

param(
    [switch]$NoFrontend
)

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

Write-Host 'Starting scheduler (pipeline runs daily at 01:00)...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$backend'; php artisan schedule:work"

Write-Host 'Starting queue worker (all jobs, per-job logs)...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$backend'; php artisan queue:work --sleep=1"

if (-not $NoFrontend) {
    Write-Host 'Starting frontend dev server (:5173)...' -ForegroundColor Cyan
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$frontend'; npm run dev"
}

Write-Host ''
Write-Host 'Running:' -ForegroundColor Green
Write-Host '  schedule:work  -> triggers pipeline:run daily at 01:00 (fetch -> trends -> score -> cleanup)'
Write-Host '  queue:work     -> executes every job; logs land in backend/storage/logs/jobs/'
if (-not $NoFrontend) {
    Write-Host '  vite           -> http://localhost:5173 (proxies /api to :8000)'
}
Write-Host ''
Write-Host 'Also start the API once: cd backend; php artisan serve' -ForegroundColor Yellow
