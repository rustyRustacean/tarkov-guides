<#
    MasterTarkov Companion - installer.

    Run this from the folder you extracted the zip into:

        powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

    It does four things, all of them undoable and none of them needing
    administrator rights:

      1. Copies companion.ps1 into %LOCALAPPDATA%\MasterTarkov-Companion
      2. Clears the "downloaded from the internet" mark on that copy
      3. Starts it - the companion writes its own no-window launcher and
         registers the masttarkov:// link the website uses to wake it
      4. Checks that it actually answered, and says so

    It does NOT add anything to Windows startup. The website starts the
    companion when you open the tracker, and the companion shuts itself down
    ten minutes after you leave.

    To undo everything: run uninstall.ps1 from this same folder.
#>

$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'companion.ps1'
$installDir = Join-Path $env:LOCALAPPDATA 'MasterTarkov-Companion'
$target = Join-Path $installDir 'companion.ps1'

Write-Host ''
Write-Host 'MasterTarkov Companion - installing' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path -LiteralPath $source)) {
    Write-Host "  companion.ps1 isn't next to this installer." -ForegroundColor Red
    Write-Host '  Extract the whole zip to a folder first, then run install.ps1 from there.'
    Write-Host ''
    Read-Host 'Press Enter to close'
    exit 1
}

# 1. The folder it lives in.
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Write-Host "  folder    $installDir"

# 2. Copy it there. Anything already listening is asked to quit first, so an
#    older copy can't hold the file open or keep serving stale data.
foreach ($port in 47800..47803) {
    try { Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/shutdown" -TimeoutSec 1 | Out-Null } catch { }
}
Start-Sleep -Milliseconds 500
Copy-Item -LiteralPath $source -Destination $target -Force
Write-Host '  copied    companion.ps1'

# 3. Files that came out of a downloaded zip are marked as internet content,
#    which Windows uses to block scripts. Clearing it on our own copy is the
#    difference between "it runs" and "it silently doesn't".
try { Unblock-File -LiteralPath $target } catch { }

#    Clear a masttarkov:// registration left pointing at a file that no longer
#    exists - an earlier build registered whichever copy was run, so a copy run
#    once from a temp folder left the handler behind after Windows cleaned that
#    folder up. The symptom is a Windows Script Host "Can not find script file"
#    box every time the site tries to start the companion, with nothing naming
#    this app. Removing the key here lets the freshly started copy below
#    re-register it correctly; a healthy registration is left untouched.
try {
    $cmdKey = 'HKCU:\Software\Classes\masttarkov\shell\open\command'
    $cmd = (Get-ItemProperty -LiteralPath $cmdKey -Name '(Default)' -ErrorAction Stop).'(Default)'
    $referenced = [regex]::Match($cmd, '"([^"]+\.(?:vbs|ps1))"')
    if ($referenced.Success -and -not (Test-Path -LiteralPath $referenced.Groups[1].Value)) {
        Remove-Item -LiteralPath 'HKCU:\Software\Classes\masttarkov' -Recurse -Force -ErrorAction Stop
        Write-Host '  cleaned   stale masttarkov:// registration from an older install'
    }
} catch { }

# 4. Start it. On startup the companion writes launch.vbs next to itself (that's
#    what runs it without a console window) and registers the masttarkov://
#    handler under HKEY_CURRENT_USER, so there is nothing else to set up here.
Start-Process powershell.exe `
    -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$target`"" `
    -WindowStyle Hidden
Write-Host '  started   waiting for it to answer...'

# 5. Prove it worked rather than assuming.
$answered = $null
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    foreach ($port in 47800..47803) {
        try {
            $body = (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/health" -TimeoutSec 1).Content
            if ($body -match 'MasterTarkov-Companion') { $answered = $port; break }
        } catch { }
    }
    if ($answered) { break }
}

Write-Host ''
if ($answered) {
    Write-Host "  Done. The companion is running on port $answered." -ForegroundColor Green
    Write-Host ''
    Write-Host '  Go back to the tracker and open the EFT Companion panel - it should'
    Write-Host '  say Connected. You can delete this extracted folder now; the copy in'
    Write-Host '  your AppData folder is the one that matters.'
} else {
    Write-Host '  It was installed, but it did not answer.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Read the log for the reason:'
    Write-Host "    notepad `"$installDir\companion.log`""
}
Write-Host ''
Read-Host 'Press Enter to close'
