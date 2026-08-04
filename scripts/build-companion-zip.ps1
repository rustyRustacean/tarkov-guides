<#
    Rebuild public/companion/MasterTarkovCompanion.zip from the loose files
    next to it, and keep the two checksum artifacts that guard against a
    corrupted or tampered download in sync with it.

    The zip is what the site's download button serves, and it is committed
    rather than generated at build time so a fresh clone is immediately
    complete. That means it goes stale the moment one of its sources is
    edited - so run this after any change to companion.ps1, install.ps1,
    uninstall.ps1, or the README:

        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-companion-zip.ps1

    What this does with checksums, and why (pre-production security audit,
    SECURITY_AUDIT.md finding 9):
      1. Hashes companion.ps1 and rewrites install.ps1's own
         $EXPECTED_COMPANION_SHA256 literal to match, BEFORE zipping - so the
         copy of install.ps1 that ships is always checking against the real
         companion.ps1 it shipped alongside, not a stale value from the last
         time someone remembered to update it by hand.
      2. After the zip is built, writes public/companion/checksums.txt - the
         zip's own SHA-256, published as a separate static file so a user who
         obtained a copy from anywhere else (an old download, a re-hosted
         mirror, a friend's copy) can verify it against the canonical value
         this build produced.
    Neither of these defends against a fully compromised deploy host serving
    a tampered zip alongside a tampered checksums.txt at the same time - no
    checksum scheme can, without a signing key this project doesn't have
    (see companion.ps1's own doc comment on why: no free fix for that). What
    they DO catch: transfer/extraction corruption, and a companion.ps1 that
    was altered or replaced after being unzipped but before install.ps1 ran.
#>

$ErrorActionPreference = 'Stop'

$dir = Join-Path (Split-Path -Parent $PSScriptRoot) 'public\companion'
$zip = Join-Path $dir 'MasterTarkovCompanion.zip'
$checksumsFile = Join-Path $dir 'checksums.txt'
$companionScript = Join-Path $dir 'companion.ps1'
$installScript = Join-Path $dir 'install.ps1'
$files = @('companion.ps1', 'install.ps1', 'uninstall.ps1', 'READ ME FIRST.txt') |
    ForEach-Object { Join-Path $dir $_ }

foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file)) { throw "missing: $file" }
}

# Keep install.ps1's embedded expected hash in sync with the real
# companion.ps1 before it gets zipped up alongside it.
$companionHash = (Get-FileHash -LiteralPath $companionScript -Algorithm SHA256).Hash
$installContent = Get-Content -LiteralPath $installScript -Raw
$pattern = "\`$EXPECTED_COMPANION_SHA256 = '[0-9a-fA-F]{64}'"
if ($installContent -notmatch $pattern) {
    throw "install.ps1's `$EXPECTED_COMPANION_SHA256 literal not found or malformed - check it wasn't hand-edited into an unexpected shape"
}
$updatedInstallContent = $installContent -replace $pattern, "`$EXPECTED_COMPANION_SHA256 = '$companionHash'"
if ($updatedInstallContent -ne $installContent) {
    Set-Content -LiteralPath $installScript -Value $updatedInstallContent -NoNewline
    Write-Host "updated install.ps1's expected checksum to $companionHash"
}

if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -LiteralPath $files -DestinationPath $zip -CompressionLevel Optimal

$size = [Math]::Round((Get-Item -LiteralPath $zip).Length / 1KB, 1)
Write-Host "built $zip ($size KB)"
foreach ($file in $files) { Write-Host "  $(Split-Path -Leaf $file)" }

$zipHash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
Set-Content -LiteralPath $checksumsFile -Value "$zipHash  MasterTarkovCompanion.zip" -NoNewline
Write-Host "wrote $checksumsFile"
Write-Host "  $zipHash  MasterTarkovCompanion.zip"
