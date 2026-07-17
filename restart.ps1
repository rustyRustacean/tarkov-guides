# Stops whatever is listening on the app's port (a previous `npm run start`),
# rebuilds, then starts the production server fresh.
#
# Usage: npm run restart   (or: powershell -ExecutionPolicy Bypass -File ./restart.ps1)

$Port = 3000

Write-Host "Stopping any process on port $Port..."
$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($connections) {
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        Write-Host "  Killing PID $processId"
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
} else {
    Write-Host "  Nothing listening on port $Port."
}

Write-Host "Building..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed (exit $LASTEXITCODE). Aborting."
    exit $LASTEXITCODE
}

Write-Host "Starting..."
npm run start
