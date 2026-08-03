<#
    Rebuild public/companion/MasterTarkovCompanion.zip from the loose files
    next to it.

    The zip is what the site's download button serves, and it is committed
    rather than generated at build time so a fresh clone is immediately
    complete. That means it goes stale the moment one of its sources is
    edited - so run this after any change to companion.ps1, install.ps1,
    uninstall.ps1, or the README:

        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-companion-zip.ps1
#>

$ErrorActionPreference = 'Stop'

$dir = Join-Path (Split-Path -Parent $PSScriptRoot) 'public\companion'
$zip = Join-Path $dir 'MasterTarkovCompanion.zip'
$files = @('companion.ps1', 'install.ps1', 'uninstall.ps1', 'READ ME FIRST.txt') |
    ForEach-Object { Join-Path $dir $_ }

foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file)) { throw "missing: $file" }
}

if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -LiteralPath $files -DestinationPath $zip -CompressionLevel Optimal

$size = [Math]::Round((Get-Item -LiteralPath $zip).Length / 1KB, 1)
Write-Host "built $zip ($size KB)"
foreach ($file in $files) { Write-Host "  $(Split-Path -Leaf $file)" }
