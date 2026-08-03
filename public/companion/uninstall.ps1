<#
    MasterTarkov Companion - remove it completely.

    Run this from the folder you extracted the zip into:

        powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1

    Removes, in this order:
      - anything of ours still listening on 47800-47803
      - the masttarkov:// registration (HKEY_CURRENT_USER only)
      - a start-with-Windows entry, if an old version left one behind
      - %LOCALAPPDATA%\MasterTarkov-Companion  (the script, launcher, and log)
      - %APPDATA%\MasterTarkov-Companion       (the remembered log-folder path)

    Nothing outside those is touched. Your Escape from Tarkov files and logs
    are not modified in any way.
#>

$ErrorActionPreference = 'Continue'

Write-Host ''
Write-Host 'MasterTarkov Companion - removing' -ForegroundColor Cyan
Write-Host ''

# 1. Ask any running copy to stop, so nothing holds the folder open.
foreach ($port in 47800..47803) {
    try {
        Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/shutdown" -TimeoutSec 1 | Out-Null
        Write-Host "  stopped   the copy on port $port"
    } catch { }
}
Start-Sleep -Milliseconds 800

# 2. The masttarkov:// handler.
$protocolKey = 'HKCU:\Software\Classes\masttarkov'
if (Test-Path -LiteralPath $protocolKey) {
    Remove-Item -LiteralPath $protocolKey -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host '  removed   masttarkov:// registration'
}

# 3. A leftover startup entry from the old executable version, if present.
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
if (Get-ItemProperty -LiteralPath $runKey -Name 'MasterTarkov-Companion' -ErrorAction SilentlyContinue) {
    Remove-ItemProperty -LiteralPath $runKey -Name 'MasterTarkov-Companion' -ErrorAction SilentlyContinue
    Write-Host '  removed   start-with-Windows entry'
}

# 4. The two folders.
foreach ($dir in @((Join-Path $env:LOCALAPPDATA 'MasterTarkov-Companion'),
                   (Join-Path $env:APPDATA 'MasterTarkov-Companion'))) {
    if (Test-Path -LiteralPath $dir) {
        Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $dir) {
            Write-Host "  LEFT      $dir (something still has a file open - delete it by hand)" -ForegroundColor Yellow
        } else {
            Write-Host "  removed   $dir"
        }
    }
}

Write-Host ''
Write-Host '  Done. Nothing of the companion is left on this PC.' -ForegroundColor Green
Write-Host ''
Read-Host 'Press Enter to close'
