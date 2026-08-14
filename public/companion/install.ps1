<#
    MasterTarkov Companion - installer.

    Run this from the folder you extracted the zip into:

        powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

    It does five things, all of them undoable and none of them needing
    administrator rights:

      1. Copies companion.ps1 into %LOCALAPPDATA%\MasterTarkov-Companion
      2. Verifies that copy's checksum, so a truncated download or a file
         altered after unzipping is caught here instead of silently run
      3. Clears the "downloaded from the internet" mark on that copy
      4. Starts it - the companion writes its own no-window launcher and
         registers the masttarkov:// link the website uses to wake it
      5. Checks that it actually answered, and says so

    It does NOT add anything to Windows startup. The website starts the
    companion when you open the tracker, and the companion shuts itself down
    ten minutes after you leave.

    To undo everything: run uninstall.ps1 from this same folder.
#>

$ErrorActionPreference = 'Stop'

# Recomputed by scripts/build-companion-zip.ps1 from the real companion.ps1
# every time it changes - don't hand-edit this, it will just be overwritten
# and, worse, will fail every future install until the next rebuild.
$EXPECTED_COMPANION_SHA256 = '54B2D2D3A7A5EB03570033D5E5292D7CDE2446B68148C4F08B3066F7711EF6BD'

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

# 2.5. Verify the copy actually matches what this installer shipped with -
#      catches a truncated download, a corrupted extraction, or the file
#      having been altered after being unzipped but before this step ran.
#      Re-hashes the file that was just copied INTO place (not $source),
#      so a bad copy is caught too, not just a bad download.
$actualHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
if ($actualHash -ne $EXPECTED_COMPANION_SHA256) {
    Write-Host '  companion.ps1 does not match its expected checksum.' -ForegroundColor Red
    Write-Host "    expected  $EXPECTED_COMPANION_SHA256"
    Write-Host "    got       $actualHash"
    Write-Host '  This usually means an incomplete download or a corrupted extraction -'
    Write-Host '  re-download the zip from the tracker and extract it again rather than'
    Write-Host '  running this copy.'
    Write-Host ''
    Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
    Read-Host 'Press Enter to close'
    exit 1
}
Write-Host '  verified  checksum matches'

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
