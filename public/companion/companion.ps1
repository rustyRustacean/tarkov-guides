<#
    MasterTarkov Companion - local log reader + localhost bridge.

    Reads the Escape from Tarkov client logs and exposes the active profile,
    game mode (PvP/PvE), quest state, raid history, and the player's last
    in-raid position over a localhost HTTP endpoint the tracker website polls.

    WHAT IT TOUCHES
      - Reads  : the EFT "Logs" folder and the names of files in "Screenshots".
      - Writes : deletes position screenshots after reading them (only files
                 whose names parse as a position screenshot), a config file and
                 a log file under %LOCALAPPDATA%\MasterTarkov-Companion, and one
                 registry key under HKEY_CURRENT_USER for the masttarkov:// link.
      - Never  : reads or writes the game's memory or process, injects anything,
                 or makes any outbound network connection. That is what keeps it
                 ban-safe, and it is not negotiable.

    Endpoints, bound to 127.0.0.1 only:
      GET /status   -> profile, mode, quests, raids, position (the full payload)
      GET /health   -> liveness ping; also refreshes the idle timer
      GET /diag     -> plain-text "why isn't this connecting" page
      GET /shutdown -> stop the companion

    /status, /health, and /shutdown all refuse any request that carries a
    browser Origin header outside the allowlist below - see
    Test-RequestAllowed. A request with no Origin header at all (this
    script's own Invoke-WebRequest calls, e.g. the self-upgrade handoff in
    Open-Bridge and install.ps1/uninstall.ps1) is never a cross-origin
    browser request in the first place, so it is trusted the same as
    before.

    Windows PowerShell 5.1, no modules, no installs. Run it with:
      powershell -NoProfile -ExecutionPolicy Bypass -File companion.ps1
#>

param(
    # Remove the masttarkov:// registration and the install folder.
    [switch]$Uninstall,
    # Stay running instead of quitting after ten idle minutes.
    [switch]$Persist,
    # The protocol handler passes "masttarkov://launch"; accept and ignore it.
    [Parameter(ValueFromRemainingArguments = $true)]
    $Rest
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Off

$APP_NAME = 'MasterTarkov-Companion'
$COMPANION_VERSION = '2.7.2'
$PROTOCOL = 'masttarkov'

$BIND_HOST = '127.0.0.1'
$BASE_PORT = [int]$(if ($env:MTC_PORT) { $env:MTC_PORT } else { 47800 })
# Fallbacks for when something unrelated already owns the preferred port. The
# website probes this same short list, so a machine that has to fall back still
# connects with nothing to configure.
#
# Each `+ 1` term MUST be parenthesized. PowerShell's comma binds tighter
# than `+`, so without parentheses the list parses as array-appends -
# "47800, 47800, 1, 47800, 2, 47800, 3" - and the range guard below then
# strips the junk, leaving four copies of the base port. That silently
# removed every fallback: a machine where another program held 47800 got no
# companion at all, while the log claimed all "four" ports were busy.
# (An earlier fix coerced each term through [int]; that changed nothing,
# because the cast binds to the operand, not to the addition.)
$PORT_CANDIDATES = @([int]$BASE_PORT, ([int]$BASE_PORT + 1), ([int]$BASE_PORT + 2), ([int]$BASE_PORT + 3)) |
    Where-Object { $_ -ge 1024 -and $_ -le 65535 }
if (@($PORT_CANDIDATES).Count -eq 0) { $PORT_CANDIDATES = @(47800, 47801, 47802, 47803) }

$IDLE_TIMEOUT = if ($env:MTC_IDLE_TIMEOUT) { [int]$env:MTC_IDLE_TIMEOUT } else { 600 }
# Raid history cap. Generous on purpose: shipping the raw history is what lets
# the site build new features without anyone reinstalling this.
$MAX_RAIDS = 500
# Delete a position screenshot after reading its coordinates, so the folder
# doesn't fill up. Set MTC_KEEP_SCREENSHOTS=1 to keep the files instead.
$DELETE_SCREENSHOTS = $env:MTC_KEEP_SCREENSHOTS -notin @('1', 'true', 'True')

# How long a single log file may be, in bytes, before only its tail is read.
# EFT's output_log can reach hundreds of megabytes; the facts this needs sit in
# the recent end of it, and reading the whole thing would stall startup.
$MAX_READ_BYTES = 12MB
# How far back into the active session's output log to look the first time it
# is read (a companion started mid-raid still learns the map), and the most
# read in one pass afterwards. Output logs reach 130 MB in a long session, so
# this file is only ever tailed, never read whole.
$LIVE_TAIL_BYTES = 4MB
# How long a position captured after the last known raid ended is held while
# waiting for the raid it belongs to to show up in the log. Long enough to
# cover the log lag, short enough that it can never be retro-tagged into some
# later, unrelated raid. Such a position has no map, so the site never draws it
# in the meantime.
$ORPHAN_POSITION_TTL = 120
# Height in pixels a clipboard snip is scaled to before OCR. Measured against
# real raid-end screenshots: a 30px-tall name reads as NOTHING at 1:1 and
# perfectly at 3x, while a 4K crop blown up 4x (208px) starts garbling. ~100px
# sat comfortably inside the range that worked at every source resolution.
$SNIP_TARGET_HEIGHT = 100
# Where clipboard snips are KEPT. Every snip is saved and NOTHING here is ever
# deleted or overwritten - a name that already exists gets a numbered suffix.
# Deliberately outside both the EFT screenshots folder (which the position
# watcher consumes from) and the companion's own install folder (which
# uninstall.ps1 removes), so nothing this app does can ever take these away.
# How many saved snips this session tracks while waiting to hear whether they
# worked. Only the bookkeeping is capped; see Remove-OldPendingSnips.
$MAX_PENDING_SNIPS = 50
$SNIP_DIR = if ($env:MTC_SNIP_DIR) {
    $env:MTC_SNIP_DIR
} else {
    Join-Path ([Environment]::GetFolderPath('MyPictures')) 'MasterTarkov Killers'
}

# ---------------------------------------------------------------------------
# Paths and logging
# ---------------------------------------------------------------------------

function Get-InstallDir {
    $base = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } elseif ($env:APPDATA) { $env:APPDATA } else { $HOME }
    return (Join-Path $base $APP_NAME)
}

function Get-ConfigPath {
    $base = if ($env:APPDATA) { $env:APPDATA } else { $HOME }
    return (Join-Path (Join-Path $base $APP_NAME) 'config.json')
}

function Get-LogPath {
    try {
        $dir = Get-InstallDir
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        return (Join-Path $dir 'companion.log')
    } catch {
        return (Join-Path $env:TEMP 'mastertarkov-companion.log')
    }
}

<#
    Append one line to the startup log.

    This runs with no console and no window, so without this a failure is
    completely invisible - nothing happens and there is nothing to read. Every
    step that can fail on someone else's machine writes here, so "it isn't
    launching" becomes a file instead of a guess.
#>
function Write-CompanionLog([string]$Message) {
    try {
        $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        Add-Content -LiteralPath (Get-LogPath) -Value "$stamp  $Message" -Encoding UTF8
    } catch {
        # A log that can't be written must never stop the companion.
    }
}

function Get-Epoch {
    return [double]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000.0)
}

<#
    Read a log file the game may still have open.

    EFT holds its logs open for writing, and the ordinary read helpers ask for a
    share mode the game refuses - which would make every log unreadable while
    the game is running, exactly when this matters. Opening the handle by hand
    with FileShare.ReadWrite is the whole point of this function.

    Files past $MAX_READ_BYTES are read from the tail only; the first line of
    such a read may be cut mid-way, which the parsers tolerate.
#>
<#
    The size a log file REALLY is right now, or -1 if it can't be opened.

    `Get-ChildItem`'s `.Length` is the directory entry, and Windows only
    refreshes that when the writing process flushes - for a log EFT holds open
    it lags the truth by however long since its last flush. Measured on this
    machine mid-raid: directory entry 2,371,203 bytes, open handle 2,381,698.

    That lag is what made the first version of the live tail useless in
    practice. The raid-start line for a Customs raid at 17:22 was on disk
    immediately, but the reported length did not grow past it until 17:25, so
    the tail had nothing to read and five screenshots taken in between were
    stamped with the PREVIOUS raid's map (the "my marker is on Ground Zero but
    I'm on Customs" report). Opening a handle reports the real length.
#>
function Get-TrueFileLength([string]$Path) {
    try {
        $fs = New-Object System.IO.FileStream(
            $Path,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
    } catch {
        return -1
    }
    try { return $fs.Length } catch { return -1 } finally { $fs.Dispose() }
}

<#
    Read the bytes a growing log has gained since we last looked at it.

    Returns @{ text; nextOffset } - or $null if the file could not be opened.
    The text is cut back to the last complete line and `nextOffset` reports
    only what was consumed, so a line still being written is left for the next
    pass instead of being half-parsed and lost. Byte counting (not character
    counting) is what keeps the offset honest on a UTF-8 file.
#>
function Read-LogRange([string]$Path, [long]$Start, [long]$End) {
    if ($End -le $Start) { return $null }
    if (($End - $Start) -gt $LIVE_TAIL_BYTES) { $Start = $End - $LIVE_TAIL_BYTES }
    try {
        $fs = New-Object System.IO.FileStream(
            $Path,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
    } catch {
        return $null
    }
    try {
        [void]$fs.Seek($Start, [System.IO.SeekOrigin]::Begin)
        $count = [int]($End - $Start)
        $buf = New-Object byte[] $count
        $read = $fs.Read($buf, 0, $count)
        if ($read -le 0) { return $null }
        $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $read)
        $cut = $text.LastIndexOf("`n")
        if ($cut -lt 0) { return @{ text = ''; nextOffset = $Start } }
        $text = $text.Substring(0, $cut + 1)
        return @{ text = $text; nextOffset = $Start + [System.Text.Encoding]::UTF8.GetByteCount($text) }
    } catch {
        return $null
    } finally {
        $fs.Dispose()
    }
}

function Read-LogText([string]$Path, [long]$MaxBytes = $MAX_READ_BYTES) {
    try {
        $fs = New-Object System.IO.FileStream(
            $Path,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
    } catch {
        return ''
    }
    try {
        if ($fs.Length -gt $MaxBytes) { [void]$fs.Seek($fs.Length - $MaxBytes, [System.IO.SeekOrigin]::Begin) }
        $reader = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
        try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
    } catch {
        return ''
    } finally {
        $fs.Dispose()
    }
}

# ---------------------------------------------------------------------------
# Finding the EFT log folder
# ---------------------------------------------------------------------------

# Install layouts seen in the wild, relative to a game or games-library folder.
$INSTALL_SUBPATHS = @(
    'Battlestate Games\Escape from Tarkov\Logs',
    'Battlestate Games\EFT\Logs',
    'Escape from Tarkov\Logs',
    'EFT\Logs'
)
$LIBRARY_PARENTS = @('', 'Games', 'Program Files', 'Program Files (x86)')

function Read-CachedRoot {
    try {
        $raw = Get-Content -LiteralPath (Get-ConfigPath) -Raw -ErrorAction Stop
        $root = (ConvertFrom-Json $raw).logRoot
        if ($root -and (Test-Path -LiteralPath $root -PathType Container)) { return $root }
    } catch { }
    return $null
}

function Save-CachedRoot([string]$Root) {
    try {
        $path = Get-ConfigPath
        $dir = Split-Path -Parent $path
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        Set-Content -LiteralPath $path -Value (ConvertTo-Json @{ logRoot = $Root } -Compress) -Encoding UTF8
    } catch { }
}

# Read EFT's install location from the uninstall registry keys (read-only).
function Get-RegistryInstallDirs {
    $keys = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\EscapeFromTarkov',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\EscapeFromTarkov',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\EscapeFromTarkov'
    )
    $found = @()
    foreach ($key in $keys) {
        try {
            $loc = (Get-ItemProperty -LiteralPath $key -Name 'InstallLocation' -ErrorAction Stop).InstallLocation
            if ($loc) { $found += (Join-Path $loc 'Logs') }
        } catch { }
    }
    return $found
}

function Find-LogRoot {
    # 1. Explicit override.
    if ($env:MTC_LOG_ROOT -and (Test-Path -LiteralPath $env:MTC_LOG_ROOT -PathType Container)) {
        return $env:MTC_LOG_ROOT
    }
    # 2. Previously resolved + cached path.
    $cached = Read-CachedRoot
    if ($cached) { return $cached }
    # 3. Registry install location.
    foreach ($cand in Get-RegistryInstallDirs) {
        if (Test-Path -LiteralPath $cand -PathType Container) { Save-CachedRoot $cand; return $cand }
    }
    # 4. Scan every drive for the known install layouts.
    foreach ($letter in [char[]]'CDEFGHIJKLMNOPQRSTUVWXYZ') {
        $drive = "${letter}:\"
        if (-not (Test-Path -LiteralPath $drive)) { continue }
        foreach ($parent in $LIBRARY_PARENTS) {
            foreach ($sub in $INSTALL_SUBPATHS) {
                $cand = if ($parent) { Join-Path (Join-Path $drive $parent) $sub } else { Join-Path $drive $sub }
                if (Test-Path -LiteralPath $cand -PathType Container) { Save-CachedRoot $cand; return $cand }
            }
        }
    }
    return $null
}

# ---------------------------------------------------------------------------
# Log parsing
# ---------------------------------------------------------------------------

$RX_MODE = [regex]::new('Session mode:\s*(?<mode>\w+)', 'IgnoreCase')
# The same line carries an AccountId. The regex matches it only to anchor the
# line reliably - it is deliberately never captured, stored, or served.
$RX_PROFILE = [regex]::new('(?:Complete)?SelectedProfile\s+ProfileId:(?<pid>\S+)\s+AccountId:\S+', 'IgnoreCase')
$RX_SIDE = [regex]::new('"Side"\s*:\s*"(Bear|Usec)"', 'IgnoreCase')
$RX_VERSION_TAIL = [regex]::new('^[\d.]+$')

# One pass over a whole application log, in order, picking up the three things
# a raid is made of: the line that names its map, the line that says the raid
# actually started, and the line that says the player is back in the menu.
# Done as a single .NET regex rather than a per-line loop because these files
# run to millions of lines and a PowerShell loop over them would take minutes.
#
# The map comes off EFT's raid-start line:
#   TRACE-NetworkGameCreate profileStatus: 'Profileid: ..., Status: Busy,
#   RaidMode: Online, Ip: 1.2.3.4, Port: 17007, Location: RezervBase, ...'
# ONLY Location is captured. The game server's Ip/Port on that same line is
# deliberately never read, stored, or served. `Location` is EFT's own internal
# id ("RezervBase", "factory4_night", "bigmap", ...), passed through verbatim -
# the site joins it to a real map via the live API, which publishes the same id
# as each map's nameId. Translating names here would ship a table that goes
# stale every wipe. A screenshot's filename carries coordinates but not the
# map, so this is the only thing that tells the site which map a position
# belongs to.
#
# TWO forms name the map, and a session may carry either. EFT 1.0.6.5 logs
# some raids the old way and others only as a `[Transit]` line:
#   2026-08-02 21:21:08.888|...|[Transit] Flag:None, RaidId:..., Count:0, Locations:bigmap ->
# Matching only `profileStatus` (as this did) left those raids invisible: no
# map tag, so every in-raid screenshot from them was dropped as unplaceable
# and no player marker ever drew. Confirmed against two real sessions an hour
# apart on the same client build - one logs each form.
#
# `Locations:` is a chain (`from -> to`) for a transit, so the map is the last
# non-empty id in it; a plain raid start logs `bigmap -> ` with nothing after
# the arrow, which reduces to the same rule.
$RX_RAID_EVENT = [regex]::new(
    '(?m)^(?<ts>\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.\d+.*?' +
    "(?:profileStatus:.*?\bLocation:\s*(?<loc>[^,']+)" +
    '|\[Transit\][^\r\n]*?\bLocations:(?<locs>[^|\r\n]*)' +
    '|(?<started>GameStarted:)|(?<left>PrepareSelectedProfileLocally))')

# The moment the local player dies in a group raid with a living teammate, the
# client switches to the spectator screen, and the coroutine driving that
# transition (`EnterSpectatingModeDelayed`) shows up in the stack traces the
# screen change writes to output_000.log. Verified against every session on
# this machine: the token appears ONLY in the one group session where the
# local player died with a teammate still alive (12 hits, both deaths), and in
# none of the solo-death sessions - a solo death goes straight to the death
# screen, no spectating, and the raid-end marker already handles it. It lives
# in continuation lines (no leading timestamp), so it is looked for with a
# plain substring scan over each live chunk rather than a timestamped regex.
$SPECTATE_MARKER = 'EnterSpectatingMode'

$NOTIF_MARKER = 'Got notification | ChatMessageReceived'
$QUEST_STATUS = @{ 10 = 'started'; 11 = 'failed'; 12 = 'finished' }

# In-raid screenshots embed the player's world position + view rotation in the
# filename, e.g.
#   2024-01-15[14-30]_-45.67, 120.89, 230.45_0.70, 0.00, 0.70, 0.00 (1).png
# Groups: x, y, z (position) then rx, ry, rz, rw (rotation quaternion).
$RX_SHOT = [regex]::new(
    '_(?<x>-?\d+\.\d+), (?<y>-?\d+\.\d+), (?<z>-?\d+\.\d+)_' +
    '(?<rx>-?\d+\.\d+), (?<ry>-?\d+\.\d+), (?<rz>-?\d+\.\d+), (?<rw>-?\d+\.\d+)')

<#
    Compass heading in degrees from the screenshot's rotation quaternion.

    Unity is Y-UP: the heading is the rotation about the vertical Y axis. The
    previous formula here was the textbook Z-up aerospace yaw
    (atan2(2(wz+xy), 1-2(y²+z²))) - for a camera that only yaws and pitches
    (x and z carry just the pitch cross-terms) that expression is IDENTICALLY
    zero in the numerator and ±cos(yaw) in the denominator, so every marker
    faced exactly north or exactly south and nothing in between. The math
    collapses, it doesn't merely drift - which is why the bug read as
    "the chevron only ever points up or down".

    This rotates the +Z (north) unit vector by the quaternion and takes the
    heading of where it lands: yaw = atan2(f_x, f_z) with
      f_x = 2(x·z + w·y)      f_z = 1 - 2(x² + y²)
    Exact at any pitch (TarkovMonitor - the tool behind tarkov.dev's own
    live-position feature - reduces to the same numerator). +90° = east,
    matching the site's clockwise CSS rotation on a north-up map.
#>
function Get-YawFromQuaternion([double]$rx, [double]$ry, [double]$rz, [double]$rw) {
    $fx = 2.0 * ($rx * $rz + $rw * $ry)
    $fz = 1.0 - 2.0 * ($rx * $rx + $ry * $ry)
    return ([Math]::Atan2($fx, $fz) * 180.0 / [Math]::PI)
}

# Return @{x; z; yaw} from an in-raid screenshot filename, or $null.
function ConvertFrom-ScreenshotName([string]$Name) {
    $m = $RX_SHOT.Match($Name)
    if (-not $m.Success) { return $null }
    try {
        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        return @{
            x   = [double]::Parse($m.Groups['x'].Value, $inv)
            z   = [double]::Parse($m.Groups['z'].Value, $inv)
            yaw = Get-YawFromQuaternion `
                ([double]::Parse($m.Groups['rx'].Value, $inv)) `
                ([double]::Parse($m.Groups['ry'].Value, $inv)) `
                ([double]::Parse($m.Groups['rz'].Value, $inv)) `
                ([double]::Parse($m.Groups['rw'].Value, $inv))
        }
    } catch {
        return $null
    }
}

function ConvertTo-NormalizedMode($Raw) {
    if (-not $Raw) { return $null }
    $low = $Raw.ToString().ToLowerInvariant()
    # EFT 1.1.0.0 added seasonal characters, logged as "Session mode: PvpSeason"
    # (the whole backend moves to gw-pvp-season.escapefromtarkov.com with it).
    # Season is checked first: a PveSeason token contains "pve" and would
    # otherwise collapse into plain pve, losing the seasonal distinction.
    if ($low -like '*season*') {
        if ($low -like 'pve*') { return 'pve_season' }
        return 'pvp_season'
    }
    if ($low -like '*pve*') { return 'pve' }
    if ($low -in @('regular', 'pvp')) { return 'pvp' }
    return $low
}

# Return @{mode; profileId} using the last occurrence of each.
function ConvertFrom-ApplicationLog([string]$Text) {
    $result = @{ mode = $null; profileId = $null }
    if (-not $Text) { return $result }
    $modes = $RX_MODE.Matches($Text)
    if ($modes.Count -gt 0) { $result.mode = ConvertTo-NormalizedMode $modes[$modes.Count - 1].Groups['mode'].Value }
    $profiles = $RX_PROFILE.Matches($Text)
    if ($profiles.Count -gt 0) { $result.profileId = $profiles[$profiles.Count - 1].Groups['pid'].Value }
    return $result
}

# One session log can hold SEVERAL characters: since 1.1.0.0 the player can
# leave to the mode screen and come back on the seasonal character without
# restarting the game (observed live - one log carrying "Session mode: Regular"
# then "Session mode: PvpSeason" nine minutes later). Anything that tags data
# with a profile therefore needs to know which character was active AT THAT
# MOMENT, not which one the session ended on. This regex walks the log once,
# in order, picking up every mode line and every completed profile selection
# with their timestamps. Prepare/CompleteSelectedProfile also fire on raid end,
# so Complete (which always accompanies an actual selection) is the anchor and
# repeats are harmless - a re-selection of the same character changes nothing.
$RX_SELECT_EVENT = [regex]::new(
    '(?m)^(?<ts>\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.\d+.*?' +
    '(?:Session mode:\s*(?<mode>\w+)' +
    '|CompleteSelectedProfile\s+ProfileId:(?<pid>\S+)\s+AccountId:\S+)')

# Ordered selection timeline for one application log:
# @( @{ at = epoch; mode = 'pvp'/'pve'/'pvp_season'/...; profileId = '...' } )
# One entry per completed profile selection, carrying the mode line that
# preceded it. Empty when the session never reached the character screen.
function ConvertFrom-SelectionTimeline([string]$Text) {
    $timeline = New-Object System.Collections.ArrayList
    if (-not $Text) { return $timeline }
    $mode = $null
    foreach ($m in $RX_SELECT_EVENT.Matches($Text)) {
        if ($m.Groups['mode'].Success) {
            $mode = ConvertTo-NormalizedMode $m.Groups['mode'].Value
            continue
        }
        [void]$timeline.Add(@{
            at        = ConvertTo-EpochFromStamp $m.Groups['ts'].Value
            mode      = $mode
            profileId = $m.Groups['pid'].Value
        })
    }
    return $timeline
}

# The timeline entry active at $Epoch: the last selection at or before it, or
# the first selection when the moment precedes them all (notifications only
# start after a selection, so that case is a clock skew, not a real gap).
# $null when the timeline is empty or the moment is unknown.
function Get-SelectionAt($Timeline, $Epoch) {
    $entries = @($Timeline)
    if ($entries.Count -eq 0) { return $null }
    if ($null -eq $Epoch) { return $entries[$entries.Count - 1] }
    $found = $null
    foreach ($entry in $entries) {
        if ($null -ne $entry.at -and $entry.at -le $Epoch) { $found = $entry }
    }
    if ($null -eq $found) { return $entries[0] }
    return $found
}

# Remember each character's mode (last selection wins). This is what lets the
# site tell a seasonal character's bucket from the main one in `profiles`.
function Update-ModeByProfile($Timeline) {
    foreach ($entry in @($Timeline)) {
        if ($entry.profileId -and $entry.mode) {
            $script:State.ModeByProfile[$entry.profileId] = $entry.mode
        }
    }
}

# A file's local-time DateTime as epoch seconds, on the same clock basis as
# ConvertTo-EpochFromStamp so the two are comparable (both local-offset).
function ConvertTo-EpochFromLocal([datetime]$Value) {
    try {
        return [double]([DateTimeOffset]::new($Value, [DateTimeOffset]::Now.Offset).ToUnixTimeSeconds())
    } catch {
        return $null
    }
}

function ConvertTo-EpochFromStamp([string]$Stamp) {
    try {
        $dt = [datetime]::ParseExact($Stamp, 'yyyy-MM-dd HH:mm:ss', [System.Globalization.CultureInfo]::InvariantCulture)
        return [double]([DateTimeOffset]::new($dt, [DateTimeOffset]::Now.Offset).ToUnixTimeSeconds())
    } catch {
        return $null
    }
}

<#
    Every raid in one session log: which map, when it started, how long.

    Deliberately reports the raw internal map id and plain timestamps rather
    than anything interpreted - the site owns the presentation, and shipping the
    unprocessed facts is what lets new features be built without anyone
    reinstalling this.

    Note on what ISN'T here: whether the raid was survived, which extract was
    used, and how many kills were taken are not written to the logs at all
    (verified across 199 sessions - ExitName/ExitStatus occur only inside
    exception stack traces, never as values). Anything claiming otherwise is
    reading dogtag loot JSON, which describes other players, not this one.
#>
function ConvertFrom-RaidLog([string]$Text) {
    $raids = New-Object System.Collections.ArrayList
    if (-not $Text) { return $raids }
    $pending = $null
    foreach ($m in $RX_RAID_EVENT.Matches($Text)) {
        $stamp = $m.Groups['ts'].Value
        $map = $null
        if ($m.Groups['loc'].Success) {
            $map = $m.Groups['loc'].Value.Trim()
        } elseif ($m.Groups['locs'].Success) {
            # `from -> to`, or just `map ->` for a normal raid start: the map
            # you end up on is the last id in the chain.
            $map = @($m.Groups['locs'].Value -split '->' |
                    ForEach-Object { $_.Trim() } |
                    Where-Object { $_ }) | Select-Object -Last 1
        }
        if ($map) {
            $pending = @{ map = $map; createdAt = $stamp; startedAt = $null; endedAt = $null; durationSec = $null }
            continue
        }
        if ($null -eq $pending) { continue }
        if ($m.Groups['started'].Success) {
            if (-not $pending.startedAt) { $pending.startedAt = $stamp }
            continue
        }
        if ($m.Groups['left'].Success -and $pending.startedAt) {
            $from = ConvertTo-EpochFromStamp $pending.startedAt
            $to = ConvertTo-EpochFromStamp $stamp
            $pending.endedAt = $stamp
            if ($null -ne $from -and $null -ne $to) { $pending.durationSec = [int][Math]::Round($to - $from) }
            [void]$raids.Add($pending)
            $pending = $null
        }
    }
    if ($null -ne $pending) {
        # Still in the raid (or the game was killed) - report it unfinished
        # rather than dropping it, so a live raid is visible too.
        [void]$raids.Add($pending)
    }
    return $raids
}

<#
    Best-effort PMC faction ("BEAR"/"USEC") for a profile.

    In end-of-raid stat blocks each player carries a "Side"; the local player's
    entry sits near their own profile id. Look for a Bear/Usec side within a
    small window around the id. Returns $null if not found.
#>
function Find-Faction([string]$Text, [string]$ProfileId) {
    if (-not $Text -or -not $ProfileId) { return $null }
    $idx = $Text.IndexOf($ProfileId, [System.StringComparison]::Ordinal)
    $checked = 0
    while ($idx -ge 0 -and $checked -lt 200) {
        $start = [Math]::Max(0, $idx - 400)
        $len = [Math]::Min($Text.Length - $start, 800)
        $m = $RX_SIDE.Match($Text.Substring($start, $len))
        if ($m.Success) { return $m.Groups[1].Value.ToUpperInvariant() }
        $checked++
        $idx = $Text.IndexOf($ProfileId, $idx + 1, [System.StringComparison]::Ordinal)
    }
    return $null
}

<#
    The balanced JSON object starting at $Start, or $null.

    The notification lines carry a JSON object followed by more log text, so it
    can't just be handed to ConvertFrom-Json - the closing brace has to be found
    by matching, with string literals and their escapes skipped.
#>
function Get-BalancedJson([string]$Text, [int]$Start) {
    $depth = 0
    $inString = $false
    $escaped = $false
    for ($i = $Start; $i -lt $Text.Length; $i++) {
        $c = $Text[$i]
        if ($inString) {
            if ($escaped) { $escaped = $false }
            elseif ($c -eq '\') { $escaped = $true }
            elseif ($c -eq '"') { $inString = $false }
            continue
        }
        if ($c -eq '"') { $inString = $true; continue }
        elseif ($c -eq '{') { $depth++ }
        elseif ($c -eq '}') {
            $depth--
            if ($depth -eq 0) { return $Text.Substring($Start, $i - $Start + 1) }
        }
    }
    return $null
}

# Ordered [taskId, status, epochOrNull] quest events from a push-notifications
# log. The epoch comes off the marker line's own timestamp; it is what lets an
# event be credited to the character that was selected when it happened,
# rather than whichever character the session happens to be on now.
function ConvertFrom-QuestLog([string]$Text) {
    $events = New-Object System.Collections.ArrayList
    if (-not $Text) { return $events }
    $idx = 0
    while ($true) {
        $hit = $Text.IndexOf($NOTIF_MARKER, $idx, [System.StringComparison]::Ordinal)
        if ($hit -lt 0) { break }
        # The marker sits mid-line; the line opens with "yyyy-MM-dd HH:mm:ss.mmm|".
        $lineStart = $Text.LastIndexOf("`n", $hit) + 1
        $at = $null
        if ($hit - $lineStart -ge 19) {
            $at = ConvertTo-EpochFromStamp $Text.Substring($lineStart, 19)
        }
        $idx = $hit + $NOTIF_MARKER.Length
        $brace = $Text.IndexOf('{', $idx)
        if ($brace -lt 0) { break }
        $json = Get-BalancedJson $Text $brace
        if (-not $json) { $idx = $brace + 1; continue }
        $idx = $brace + $json.Length
        try { $obj = ConvertFrom-Json $json } catch { continue }
        $message = $obj.message
        if (-not $message) { continue }
        $status = $QUEST_STATUS[[int]$message.type]
        if (-not $status) { continue }
        $templateId = [string]$message.templateId
        $taskId = ($templateId -split ' ', 2)[0]
        if ($taskId) { [void]$events.Add(@($taskId, $status, $at)) }
    }
    return $events
}

# ---------------------------------------------------------------------------
# Monitor state
#
# Everything the companion knows lives here. It is plain script state rather
# than an object with locks because the whole program is one loop: requests,
# log polling, and the initial backfill all take turns on the same thread, so
# nothing can ever read a half-written snapshot.
# ---------------------------------------------------------------------------

$script:State = @{
    Root              = $null
    ScreenshotsDirs   = @()
    QuestsByProfile   = @{}      # profileId -> @{ taskId = status }
    FactionByProfile  = @{}      # profileId -> "BEAR" / "USEC"
    ModeByProfile     = @{}      # profileId -> "pvp" / "pve" / "pvp_season" / ...
    ActiveProfile     = $null
    ActiveMode        = $null
    # The live session's selection timeline (see ConvertFrom-SelectionTimeline).
    # Kept so quest events arriving between application-log growths still land
    # on the right character.
    SessionSelections = @()
    ActiveSession     = $null
    GameVersion       = $null
    QuestsAvailable   = $false
    Revision          = 0        # bumps whenever anything changes
    UpdatedAt         = 0.0
    Position          = $null    # @{x; z; yaw; at; map}
    PositionRevision  = 0
    RaidLocation      = $null    # internal map id of the current/most recent raid
    # Whether that raid is still open. Only an open raid may stamp a screenshot
    # with its map (see Update-Screenshots).
    InRaid            = $false
    # The local player died in the open raid and is spectating a teammate.
    # While true, position screenshots are consumed but IGNORED: the spectator
    # camera is glued to the living teammate, so their coordinates are the
    # teammate's position (with the camera's orientation, not anyone's facing) -
    # publishing them painted a dead player's marker on top of the player being
    # watched. Set by the spectate marker in Update-LiveRaidFromOutput, cleared
    # on raid end / new raid / session switch.
    DiedInRaid        = $false
    Raids             = (New-Object System.Collections.ArrayList)
    SeenShots         = @{}
    # snipId -> @{ path; eftRunning; at } for saved snips awaiting a verdict
    # from the site (see Confirm-Snip). Session-only: a restart simply means
    # those snips are kept, which is the safe outcome.
    PendingSnips      = @{}
    # Folders whose pre-existing screenshots have been fenced off as
    # untouchable (see Update-ScreenshotsIn's priming pass).
    ShotsPrimed       = @{}
    # Last monitor-loop error logged, so a repeating failure is written once
    # rather than every 2-second tick (see Invoke-MonitorTick).
    LastMonitorError  = $null
    AppSize           = -1
    NotifSize         = -1
    # Byte offset already consumed from the active session's output log, and
    # the raid being pieced together from it (see Update-LiveRaidFromOutput).
    # -1 means "this session's output log has not been looked at yet".
    OutOffset         = -1
    LiveRaid          = $null
    SessionDir        = $null
    SessionsSeen      = 0
    BackfillQueue     = @()
    BackfillIndex     = 0
    LastContact       = 0.0
    RejectedOrigins   = (New-Object System.Collections.ArrayList)
    # Which sites were let in, and how many requests have been served at all.
    # Without these, /diag can only report refusals - and "nothing was refused"
    # reads exactly the same whether the tracker is working or has never once
    # asked, which is the single most common thing someone needs to tell apart.
    AllowedOrigins    = (New-Object System.Collections.ArrayList)
    RequestCount      = 0
    LastRequestAt     = 0.0
    Running           = $true
    Port              = 0
}

# The start time a session folder's name embeds, as one sortable string.
# EFT does NOT zero-pad the HOUR: a real afternoon produced
# log_2026.08.10_9-37-08_... and log_2026.08.10_15-04-16_... side by side.
$RX_SESSION_STAMP = [regex]::new('^log_(?<d>\d{4}\.\d{2}\.\d{2})_(?<h>\d{1,2})-(?<m>\d{2})-(?<s>\d{2})')
function Get-SessionSortKey([string]$Name) {
    $m = $RX_SESSION_STAMP.Match($Name)
    if (-not $m.Success) { return $Name }
    return '{0}_{1:00}-{2}-{3}' -f $m.Groups['d'].Value, [int]$m.Groups['h'].Value,
        $m.Groups['m'].Value, $m.Groups['s'].Value
}

function Get-Sessions {
    if (-not $script:State.Root -or -not (Test-Path -LiteralPath $script:State.Root -PathType Container)) { return @() }
    try {
        # Sorted by the START TIME embedded in the name - NOT by the folder's
        # LastWriteTime, and NOT by the raw name either:
        #   - LastWriteTime only moves when a file is created inside, and EFT
        #     touches old session folders long after newer ones exist - one
        #     such touch made the companion tail a finished session for
        #     minutes while the player was raiding in the newest one.
        #   - The raw name is NOT chronological, because EFT does not
        #     zero-pad the hour: "log_2026.08.10_9-37-08" sorts lexically
        #     AFTER "log_2026.08.10_15-04-16" ('9' > '1'), so every game
        #     session started between 10:00 and 19:59 was shadowed by a
        #     single-digit-hour session from the same morning. Found live:
        #     the companion spent a whole afternoon tailing the 9:37 session
        #     while the player raided in the 15:04 one - no raid tag, no
        #     placeable position, and teammates saw nothing from this player.
        # Get-SessionSortKey re-pads the hour, making the sort chronological.
        return @(Get-ChildItem -LiteralPath $script:State.Root -Directory -Filter 'log_*' -ErrorAction Stop |
                Sort-Object { Get-SessionSortKey $_.Name })
    } catch {
        return @()
    }
}

function Get-SessionFile($Session, [string]$Needle) {
    try {
        foreach ($f in Get-ChildItem -LiteralPath $Session.FullName -Filter '*.log' -File -ErrorAction Stop) {
            if ($f.Name.ToLowerInvariant().Contains($Needle)) { return $f }
        }
    } catch { }
    return $null
}

function Set-Changed {
    $script:State.Revision++
    $script:State.UpdatedAt = Get-Epoch
}

<#
    Fold one past session into the reconstructed state.

    Backfill is done one session per main-loop pass rather than all at once so
    the bridge answers from the first second. A machine with hundreds of
    sessions and a multi-gigabyte log folder would otherwise spend a minute
    looking exactly like a companion that failed to start.
#>
function Import-Session($Session) {
    $profileId = $null
    $mode = $null
    $timeline = @()
    $app = Get-SessionFile $Session 'application'
    if ($app) {
        $appText = Read-LogText $app.FullName
        $parsed = ConvertFrom-ApplicationLog $appText
        $profileId = $parsed.profileId
        $mode = $parsed.mode
        $timeline = @(ConvertFrom-SelectionTimeline $appText)
        Update-ModeByProfile $timeline
        foreach ($raid in ConvertFrom-RaidLog $appText) {
            # A session can straddle characters (mode screen -> seasonal), so
            # each raid is tagged with the selection active when it was
            # created, falling back to the session-wide values.
            $sel = Get-SelectionAt $timeline (ConvertTo-EpochFromStamp $raid.createdAt)
            $raid.mode = $(if ($sel -and $sel.mode) { $sel.mode } else { $mode })
            $raid.profileId = $(if ($sel) { $sel.profileId } else { $profileId })
            # Which session log this raid was read from. The live session is
            # re-read as it grows (see Update-ActiveSession), and replaces its
            # own raids by this tag rather than appending duplicates.
            $raid.session = $Session.Name
            [void]$script:State.Raids.Add($raid)
        }
    }

    $fallbackKey = if ($profileId) { $profileId } else { '_unknown' }
    # A character with no quest events yet still gets its bucket, so it shows
    # up in the profiles map from its first session.
    if (-not $script:State.QuestsByProfile.ContainsKey($fallbackKey)) { $script:State.QuestsByProfile[$fallbackKey] = @{} }

    $notif = Get-SessionFile $Session 'push-notifications'
    if ($notif) {
        $script:State.QuestsAvailable = $true
        foreach ($evt in ConvertFrom-QuestLog (Read-LogText $notif.FullName)) {
            $sel = Get-SelectionAt $timeline $evt[2]
            $key = if ($sel) { $sel.profileId } else { $fallbackKey }
            if (-not $script:State.QuestsByProfile.ContainsKey($key)) { $script:State.QuestsByProfile[$key] = @{} }
            $script:State.QuestsByProfile[$key][$evt[0]] = $evt[1]
        }
    }

    # Resolve faction once per real profile (stops scanning a profile as soon as
    # some session reveals its Side).
    if ($profileId -and -not $script:State.FactionByProfile.ContainsKey($profileId)) {
        foreach ($needle in @('output', 'application')) {
            $src = Get-SessionFile $Session $needle
            if (-not $src) { continue }
            $side = Find-Faction (Read-LogText $src.FullName) $profileId
            if ($side) { $script:State.FactionByProfile[$profileId] = $side; break }
        }
    }
    Set-Changed
}

function Step-Backfill {
    if ($script:State.BackfillIndex -ge $script:State.BackfillQueue.Count) { return $false }
    $session = $script:State.BackfillQueue[$script:State.BackfillIndex]
    $script:State.BackfillIndex++
    try {
        Import-Session $session
    } catch {
        Write-CompanionLog "backfill skipped $($session.Name): $($_.Exception.Message)"
    }
    if ($script:State.BackfillIndex -ge $script:State.BackfillQueue.Count) {
        # Keep the newest raids only, and let the live tail take over.
        if ($script:State.Raids.Count -gt $MAX_RAIDS) {
            $keep = $script:State.Raids.GetRange($script:State.Raids.Count - $MAX_RAIDS, $MAX_RAIDS)
            $script:State.Raids = New-Object System.Collections.ArrayList
            [void]$script:State.Raids.AddRange($keep)
        }
        Write-CompanionLog "backfill complete: $($script:State.BackfillQueue.Count) sessions, $($script:State.Raids.Count) raids"
    }
    return $true
}

<#
    Learn the current raid from the session's OUTPUT log, live.

    THE BUG THIS EXISTS FOR: raid markers were read only from
    `application_000.log`, and EFT buffers that file. It is tiny (~35 KB for a
    whole evening), so it flushes rarely - measured on 2026-08-09, the
    `Location: Sandbox_high` line for a raid entered at 16:13 did not reach
    disk until after the raid ENDED at 16:22. Every screenshot taken in that
    raid was therefore parsed with `map=(none yet)`, the site refused to place
    an untagged position (correctly - it cannot know which map it belongs to),
    and the player's marker never appeared. The retro-tag added for exactly
    this case could not help either: by the time the map was known the raid was
    already over, so the position was cleared instead.

    `output_000.log` carries the same three markers verbatim (verified across
    every session on this machine - identical lines, only an extra `output|`
    field) and is written continuously because everything else in the game
    logs there too. So the map is read from the file the game actually keeps
    flushing, and the application log stays the source for history, mode,
    profile and the selection timeline.

    Only the new bytes are read each pass; see Read-LogRange.
#>
function Update-LiveRaidFromOutput($Session) {
    $out = Get-SessionFile $Session 'output'
    if (-not $out) { return $false }
    $len = Get-TrueFileLength $out.FullName
    if ($len -lt 0) { return $false }
    if ($script:State.OutOffset -lt 0 -or $len -lt $script:State.OutOffset) {
        # First sight of this session, or the file was rotated/truncated.
        $script:State.OutOffset = [long][Math]::Max(0, $len - $LIVE_TAIL_BYTES)
        $script:State.LiveRaid = $null
    }
    if ($len -le $script:State.OutOffset) { return $false }
    $chunk = Read-LogRange $out.FullName $script:State.OutOffset $len
    if ($null -eq $chunk) { return $false }
    $script:State.OutOffset = $chunk.nextOffset
    if (-not $chunk.text) { return $false }

    $changed = $false
    # Byte position (within this chunk) of the last raid-START event, so the
    # spectate scan below can tell a death in the CURRENT raid from the tail of
    # a previous one that happens to share the chunk. -1 = no raid started here.
    $lastMapIdx = -1
    foreach ($m in $RX_RAID_EVENT.Matches($chunk.text)) {
        $stamp = $m.Groups['ts'].Value
        $map = $null
        if ($m.Groups['loc'].Success) {
            $map = $m.Groups['loc'].Value.Trim()
        } elseif ($m.Groups['locs'].Success) {
            $map = @($m.Groups['locs'].Value -split '->' |
                    ForEach-Object { $_.Trim() } |
                    Where-Object { $_ }) | Select-Object -Last 1
        }
        if ($map) {
            $script:State.LiveRaid = @{
                map = $map; createdAt = $stamp; startedAt = $null
                endedAt = $null; durationSec = $null
            }
            # A fresh raid means a fresh life - the dead-gate belongs to the
            # raid it happened in, never the next one.
            $script:State.DiedInRaid = $false
            $lastMapIdx = $m.Index
            $changed = $true
            Write-CompanionLog "raid started: $map"
            continue
        }
        $live = $script:State.LiveRaid
        if ($null -eq $live -or $live.endedAt) { continue }
        if ($m.Groups['started'].Success) {
            if (-not $live.startedAt) { $live.startedAt = $stamp; $changed = $true }
            continue
        }
        if ($m.Groups['left'].Success -and $live.startedAt) {
            $from = ConvertTo-EpochFromStamp $live.startedAt
            $to = ConvertTo-EpochFromStamp $stamp
            $live.endedAt = $stamp
            if ($null -ne $from -and $null -ne $to) { $live.durationSec = [int][Math]::Round($to - $from) }
            $changed = $true
        }
    }

    # Death detection (see $SPECTATE_MARKER). Only a marker that appears AFTER
    # the last raid start in this chunk counts - one before it belongs to the
    # raid that ended, whose gate the raid-start branch above already lifted.
    if (-not $script:State.DiedInRaid -and $null -ne $script:State.LiveRaid -and
        -not $script:State.LiveRaid.endedAt) {
        $specIdx = $chunk.text.LastIndexOf($SPECTATE_MARKER)
        if ($specIdx -gt $lastMapIdx) {
            $script:State.DiedInRaid = $true
            $changed = $true
            if ($null -ne $script:State.Position) {
                $script:State.Position = $null
                $script:State.PositionRevision++
            }
            Write-CompanionLog 'player died (now spectating) - position cleared, screenshots ignored until raid end'
        }
    }
    return $changed
}

<#
    Fold the live raid into this session's history, and let the freshest raid
    decide the map tag and whether the player is still in a raid.

    The same raid reaches `Raids` from the application log once that file
    finally flushes, so a raid already there is kept (it carries the character
    bucketing) and only gains an end time from the live copy if it is missing
    one.
#>
function Merge-LiveRaid([string]$SessionName, $Parsed) {
    $live = $script:State.LiveRaid
    if ($null -eq $live) { return }
    $existing = @($script:State.Raids.ToArray() |
            Where-Object { $_.session -eq $SessionName -and $_.createdAt -eq $live.createdAt })
    if ($existing.Count -gt 0) {
        $raid = $existing[0]
        if (-not $raid.endedAt -and $live.endedAt) {
            $raid.endedAt = $live.endedAt
            $raid.durationSec = $live.durationSec
        }
        return
    }
    $sel = Get-SelectionAt $script:State.SessionSelections (ConvertTo-EpochFromStamp $live.createdAt)
    $raid = @{
        map = $live.map; createdAt = $live.createdAt; startedAt = $live.startedAt
        endedAt = $live.endedAt; durationSec = $live.durationSec
        session = $SessionName
        mode = $(if ($sel -and $sel.mode) { $sel.mode } elseif ($Parsed) { $Parsed.mode } else { $script:State.ActiveMode })
        profileId = $(if ($sel) { $sel.profileId } else { $script:State.ActiveProfile })
    }
    [void]$script:State.Raids.Add($raid)
}

<#
    Point the map tag at the newest raid, and keep the served position honest.

    A raid with an end marker means the player is back in the menu - dead or
    extracted - so the position they were standing at is stale: drop it, and
    the site (plus every teammate, via the null presence publish) stops drawing
    the marker. A position captured a moment before the raid line was read
    carries no map and cannot be placed; once the raid is known and still open,
    give it that tag rather than throwing a real capture away. Positions never
    outlive their raid, so this cannot tag a stale one.
#>
function Sync-PositionWithRaid([string]$SessionName) {
    $last = @($script:State.Raids.ToArray() | Where-Object { $_.session -eq $SessionName }) |
        Select-Object -Last 1
    if ($null -eq $last) { return }
    $script:State.RaidLocation = $last.map
    $inRaid = -not $last.endedAt
    $script:State.InRaid = $inRaid
    # The dead-gate is only meaningful inside an open raid; back in the menu
    # the player isn't spectating anyone, whichever way the raid ended.
    if (-not $inRaid) { $script:State.DiedInRaid = $false }
    if (-not $inRaid -and $null -ne $script:State.Position) {
        # Clear only what this ended raid could actually have produced - a
        # position carrying its map. An UNTAGGED one was captured while no raid
        # was open, which can only mean the player is in a raid the log has not
        # caught up with, so hold it (briefly) and let the retro-tag below place
        # it the moment that raid appears. Without this, a screenshot taken in
        # the first seconds of a new raid was thrown away purely because the
        # raid had not been parsed yet.
        #
        # "Untagged" is the test rather than a comparison of the capture time
        # against the raid's end stamp: those are two different clocks (wall
        # clock vs the game's log timestamps), and only the age below - both
        # ends of which come from Get-Epoch - is safe to compare.
        $pending = [string]::IsNullOrEmpty([string]$script:State.Position.map)
        $fresh = ((Get-Epoch) - $script:State.Position.at) -lt $ORPHAN_POSITION_TTL
        if (-not ($pending -and $fresh)) {
            $script:State.Position = $null
            $script:State.PositionRevision++
            Set-Changed
            Write-CompanionLog 'raid over - cleared last position'
        }
    }
    if ($inRaid -and $script:State.RaidLocation -and
        $null -ne $script:State.Position -and
        [string]::IsNullOrEmpty([string]$script:State.Position.map)) {
        $script:State.Position.map = $script:State.RaidLocation
        $script:State.PositionRevision++
        Set-Changed
        Write-CompanionLog "tagged pending position with map $($script:State.RaidLocation)"
    }
}

# Re-read the newest session's files if they've grown, and pick up a session switch.
function Update-ActiveSession {
    $sessions = Get-Sessions
    $script:State.SessionsSeen = $sessions.Count
    if ($sessions.Count -eq 0) { return }
    $newest = $sessions[$sessions.Count - 1]

    $switched = ($null -eq $script:State.SessionDir) -or ($newest.FullName -ne $script:State.SessionDir)
    if ($switched) {
        $script:State.SessionDir = $newest.FullName
        $script:State.AppSize = -1
        $script:State.NotifSize = -1
        $script:State.OutOffset = -1
        $script:State.LiveRaid = $null
        $script:State.SessionSelections = @()
        # A new game session hasn't entered a raid yet - don't let the previous
        # session's map tag the next screenshot, and don't keep serving a
        # position from a raid that ended when the game was closed.
        $script:State.RaidLocation = $null
        $script:State.InRaid = $false
        $script:State.DiedInRaid = $false
        if ($null -ne $script:State.Position) {
            $script:State.Position = $null
            $script:State.PositionRevision++
        }
    }

    $changed = $switched
    $parsed = $null
    $app = Get-SessionFile $newest 'application'
    if ($app) {
        $size = $app.Length
        if ($size -ne $script:State.AppSize) {
            $script:State.AppSize = $size
            $appText = Read-LogText $app.FullName
            $parsed = ConvertFrom-ApplicationLog $appText
            # Re-read THIS session's raids every time its log grows, so a raid
            # entered after the companion started still lands in `raids` (they
            # used to come only from the one-shot backfill pass, which meant
            # the live session's raids were whatever existed at startup and
            # never moved - the raid you're in right now was missing).
            # Replacing this session's own entries keeps that idempotent.
            # `@(...)` is load-bearing: ConvertFrom-RaidLog returns an
            # ArrayList, which PowerShell unrolls on return - a session with
            # exactly one raid would otherwise arrive as a bare hashtable,
            # whose `.Count` is its KEY count (5), so the "last raid" lookup
            # below indexed past the end and silently produced no map tag.
            # That is precisely the bug that left a real Customs raid
            # untagged, so no screenshot from it could ever be placed.
            $sessionRaids = @(ConvertFrom-RaidLog $appText)
            $script:State.SessionSelections = @(ConvertFrom-SelectionTimeline $appText)
            Update-ModeByProfile $script:State.SessionSelections
            if ($script:State.Raids.Count -gt 0) {
                $kept = @($script:State.Raids.ToArray() | Where-Object { $_.session -ne $newest.Name })
                $script:State.Raids = New-Object System.Collections.ArrayList
                if ($kept.Count -gt 0) { [void]$script:State.Raids.AddRange($kept) }
            }
            foreach ($raid in $sessionRaids) {
                # Tag each raid with the character selected when it was created
                # (one session can carry both the main and the seasonal one).
                $sel = Get-SelectionAt $script:State.SessionSelections (ConvertTo-EpochFromStamp $raid.createdAt)
                $raid.mode = $(if ($sel -and $sel.mode) { $sel.mode } else { $parsed.mode })
                $raid.profileId = $(if ($sel) { $sel.profileId } else { $parsed.profileId })
                $raid.session = $newest.Name
                [void]$script:State.Raids.Add($raid)
            }
            if ($parsed.mode) { $script:State.ActiveMode = $parsed.mode }
            if ($parsed.profileId) {
                $script:State.ActiveProfile = $parsed.profileId
                if (-not $script:State.QuestsByProfile.ContainsKey($parsed.profileId)) {
                    $script:State.QuestsByProfile[$parsed.profileId] = @{}
                }
            }
            # Session dir name ends with the client version, e.g.
            # log_2026.08.01_20-08-18_1.0.6.5.46221
            $ver = ($newest.Name -split '_')[-1]
            if ($RX_VERSION_TAIL.IsMatch($ver)) { $script:State.GameVersion = $ver }
            $changed = $true
        }
    }

    # The output log is read AFTER the application log, every pass (not only
    # when the application log grows), because it is the one that flushes
    # while a raid is running - it is what makes the map tag arrive in time
    # for the screenshot that needs it.
    if (Update-LiveRaidFromOutput $newest) { $changed = $true }
    Merge-LiveRaid $newest.Name $parsed
    Sync-PositionWithRaid $newest.Name

    $notif = Get-SessionFile $newest 'push-notifications'
    if ($notif) {
        $script:State.QuestsAvailable = $true
        $size = $notif.Length
        if ($size -ne $script:State.NotifSize) {
            $script:State.NotifSize = $size
            $fallbackKey = if ($script:State.ActiveProfile) { $script:State.ActiveProfile } else { '_unknown' }
            foreach ($evt in ConvertFrom-QuestLog (Read-LogText $notif.FullName)) {
                # Credit the event to the character selected when it fired, not
                # the one the session is on now - switching to the seasonal
                # character mid-session must not pull the main character's
                # events into the seasonal bucket (or vice versa).
                $sel = Get-SelectionAt $script:State.SessionSelections $evt[2]
                $key = if ($sel) { $sel.profileId } else { $fallbackKey }
                if (-not $script:State.QuestsByProfile.ContainsKey($key)) { $script:State.QuestsByProfile[$key] = @{} }
                $script:State.QuestsByProfile[$key][$evt[0]] = $evt[1]
            }
            $changed = $true
        }
    }

    $script:State.ActiveSession = $newest.Name
    if ($changed) { Set-Changed }
}

<#
    Every folder EFT may write position screenshots into.

    The game saves screenshots under the user's DOCUMENTS folder
    ("Documents\Escape from Tarkov\Screenshots") - NOT under the install
    directory. This used to watch only "<install>\Screenshots" (derived from
    the log root), a folder the game never writes to - so on a real machine
    every in-raid screenshot landed unseen in Documents and no position was
    ever read. Found the hard way: a raid's screenshots sitting in Documents
    with perfect coordinates while the watched folder stayed empty all night.

    Both Documents spellings are listed because a machine with OneDrive
    folder redirection can have the shell "MyDocuments" folder and the
    literal %USERPROFILE%\Documents disagree; the install-dir sibling stays
    as a fallback for nonstandard setups. Nonexistent candidates are skipped
    per scan (cheap), so a folder that appears later is picked up without a
    restart.
#>
function Get-ScreenshotsDirs([string]$Root) {
    $dirs = New-Object System.Collections.ArrayList
    try {
        $docs = [Environment]::GetFolderPath('MyDocuments')
        if ($docs) { [void]$dirs.Add((Join-Path $docs 'Escape from Tarkov\Screenshots')) }
    } catch { }
    if ($env:USERPROFILE) {
        $literal = Join-Path $env:USERPROFILE 'Documents\Escape from Tarkov\Screenshots'
        if ($literal -notin $dirs) { [void]$dirs.Add($literal) }
    }
    if ($Root) {
        $sibling = Join-Path (Split-Path -Parent $Root) 'Screenshots'
        if ($sibling -notin $dirs) { [void]$dirs.Add($sibling) }
    }
    return @($dirs.ToArray())
}

<#
    Read the newest in-raid screenshots for position, then remove them.

    Only files whose names parse as a position screenshot are ever deleted; any
    other file in the folder is left untouched.
#>
function Update-Screenshots {
    foreach ($folder in $script:State.ScreenshotsDirs) {
        Update-ScreenshotsIn $folder
    }
}

function Update-ScreenshotsIn([string]$folder) {
    if (-not $folder -or -not (Test-Path -LiteralPath $folder -PathType Container)) { return }
    try {
        $shots = @(Get-ChildItem -LiteralPath $folder -Filter '*.png' -File -ErrorAction Stop | Sort-Object LastWriteTime)
    } catch {
        return
    }
    # First sight of a folder: everything already in it predates this run.
    # Those are the user's own captures - never read, never deleted, even
    # when their names carry coordinates. Only a screenshot that APPEARS
    # while the companion is running was taken "for the tracker" and gets
    # consumed. (This replaced eating the whole coordinate-named backlog on
    # startup, which deleted screenshots the user had kept on purpose; a
    # position from an old file would be stale anyway - the raid it belongs
    # to is over, and the in-raid-only rule would clear it moments later.)
    if (-not $script:State.ShotsPrimed.ContainsKey($folder)) {
        $script:State.ShotsPrimed[$folder] = $true
        # One exception to the fence: a screenshot taken DURING the raid that
        # is open right now. "Press F12, then open the browser" starts the
        # companion after the capture, so the position the player explicitly
        # asked for landed in the folder before the first scan - fencing it
        # meant that flow NEVER produced a marker. A file whose write time is
        # at/after the current raid's start is this raid's capture, not a
        # kept memento; consume the newest such file, fence the rest.
        $raidStart = $null
        if ($script:State.InRaid -and $null -ne $script:State.LiveRaid) {
            $raidStart = ConvertTo-EpochFromStamp $script:State.LiveRaid.createdAt
        }
        $adopt = $null
        if ($script:State.DiedInRaid) { $raidStart = $null }
        if ($null -ne $raidStart) {
            foreach ($shot in $shots) {
                # $shots is sorted by LastWriteTime, so the last match wins.
                $wrote = ConvertTo-EpochFromLocal $shot.LastWriteTime
                if ($null -ne $wrote -and $wrote -ge $raidStart -and
                    $null -ne (ConvertFrom-ScreenshotName $shot.Name)) {
                    $adopt = $shot
                }
            }
        }
        foreach ($shot in $shots) {
            if ($null -ne $adopt -and $shot.FullName -eq $adopt.FullName) { continue }
            $script:State.SeenShots[$shot.FullName] = $true
        }
        if ($null -ne $adopt) {
            Write-CompanionLog "adopting in-raid screenshot from before startup: $($adopt.Name)"
        }
        if ($null -eq $adopt) { return }
        # Fall through: the adopted shot is unseen and gets consumed below.
    }
    foreach ($shot in $shots) {
        # Keyed by full path - the same file name can exist in two watched
        # folders and they are different screenshots.
        if ($script:State.SeenShots.ContainsKey($shot.FullName)) { continue }
        $parsed = ConvertFrom-ScreenshotName $shot.Name
        if ($null -eq $parsed) {
            # Not a position screenshot - never touch it.
            $script:State.SeenShots[$shot.FullName] = $true
            continue
        }
        # A screenshot taken while dead is a SPECTATOR screenshot: the camera
        # is glued to the living teammate being watched, so its coordinates
        # are the teammate's position and its rotation is the camera's, not
        # any player's facing. Publishing it painted the dead player's marker
        # on top of the teammate, pointing somewhere neither of them faced.
        # Still consumed (deleted per the usual rule) so it doesn't sit in
        # the folder and get adopted by a later run - just never served.
        if ($script:State.DiedInRaid) {
            Write-CompanionLog "spectator screenshot ignored (player is dead): $($shot.Name)"
        } else {
            # `map` is the raid this shot came from. Without it the site can't
            # tell which map the coordinates belong to and refuses to draw
            # them.
            #
            # Only an OPEN raid may stamp it. If the newest raid we have read
            # has already ended, this shot cannot belong to it - the player is
            # in a raid the log has not caught up with - and stamping it
            # anyway is what put the marker on the previous raid's map. Left
            # null, it is placed by the retro-tag in Sync-PositionWithRaid as
            # soon as the real raid appears. No map is recoverable; the wrong
            # map is not.
            $script:State.Position = @{
                x   = $parsed.x
                z   = $parsed.z
                yaw = $parsed.yaw
                at  = Get-Epoch
                map = $(if ($script:State.InRaid) { $script:State.RaidLocation } else { $null })
            }
            $script:State.PositionRevision++
            Set-Changed
            # One line per capture (they are rare and user-initiated). "map="
            # being empty here is the signature of the position-that-never-
            # draws problem, which used to be undiagnosable without it.
            Write-CompanionLog ("position screenshot: x={0} z={1} map={2}" -f $parsed.x, $parsed.z, $(
                if ($script:State.RaidLocation) { $script:State.RaidLocation } else { '(none yet)' }))
        }
        if ($DELETE_SCREENSHOTS) {
            try { Remove-Item -LiteralPath $shot.FullName -Force -ErrorAction Stop }
            catch { $script:State.SeenShots[$shot.FullName] = $true }
        } else {
            $script:State.SeenShots[$shot.FullName] = $true
        }
    }
}

<#
    A transient read error must never kill the loop - but it must never be
    INVISIBLE either. These catches used to be empty, and that silence cost a
    real debugging session: an exception thrown after `AppSize` was updated
    but before the raids were stored meant raid detection died permanently
    while everything else looked healthy - no raids, no map tag, no marker,
    and nothing anywhere saying why. Each distinct error is logged once (not
    per 2-second tick, which would flood the log with the same line).
#>
function Invoke-MonitorTick {
    try { Update-ActiveSession } catch {
        $msg = "Update-ActiveSession failed: $($_.Exception.Message) (line $($_.InvocationInfo.ScriptLineNumber))"
        if ($msg -ne $script:State.LastMonitorError) {
            $script:State.LastMonitorError = $msg
            Write-CompanionLog $msg
        }
    }
    try { Update-Screenshots } catch {
        $msg = "Update-Screenshots failed: $($_.Exception.Message) (line $($_.InvocationInfo.ScriptLineNumber))"
        if ($msg -ne $script:State.LastMonitorError) {
            $script:State.LastMonitorError = $msg
            Write-CompanionLog $msg
        }
    }
}

# ---------------------------------------------------------------------------
# The payload
# ---------------------------------------------------------------------------

function Get-QuestCounts($QuestState) {
    $counts = [ordered]@{ started = 0; finished = 0; failed = 0 }
    foreach ($status in $QuestState.Values) {
        if ($counts.Contains($status)) { $counts[$status] = $counts[$status] + 1 }
    }
    return $counts
}

function Get-Snapshot {
    $profileId = $script:State.ActiveProfile
    $quests = @{}
    if ($profileId -and $script:State.QuestsByProfile.ContainsKey($profileId)) {
        $quests = $script:State.QuestsByProfile[$profileId]
    }

    $profiles = @{}
    foreach ($key in @($script:State.QuestsByProfile.Keys)) {
        $state = $script:State.QuestsByProfile[$key]
        $profiles[$key] = @{
            quests  = $state
            faction = $script:State.FactionByProfile[$key]
            # Which mode this character was last selected under - the seasonal
            # character is just another profile id, and this is what tells the
            # site its bucket is the seasonal one.
            mode    = $script:State.ModeByProfile[$key]
            counts  = Get-QuestCounts $state
        }
    }

    $backfillTotal = $script:State.BackfillQueue.Count
    $backfillDone = [Math]::Min($script:State.BackfillIndex, $backfillTotal)

    return [ordered]@{
        app              = $APP_NAME
        version          = $COMPANION_VERSION
        running          = $true
        logRoot          = [string]$script:State.Root
        session          = $script:State.ActiveSession
        gameVersion      = $script:State.GameVersion
        mode             = $script:State.ActiveMode
        profileId        = $profileId
        faction          = $(if ($profileId) { $script:State.FactionByProfile[$profileId] } else { $null })
        questsAvailable  = $script:State.QuestsAvailable
        quests           = $quests
        questCounts      = Get-QuestCounts $quests
        position         = $script:State.Position
        positionRevision = $script:State.PositionRevision
        revision         = $script:State.Revision
        updatedAt        = $script:State.UpdatedAt

        # --- everything below is the raw superset -------------------------
        # Shipped whether or not the site currently reads it, so a new feature
        # is a website change rather than something every user has to
        # reinstall.
        #
        # `capabilities` is the handshake: the site feature-detects against it
        # instead of comparing version numbers, so an older companion degrades
        # gracefully rather than breaking.
        capabilities     = @(
            'quests', 'position', 'positionMap', 'faction',
            'raids', 'allProfiles', 'diag', 'backfill',
            # Per-profile `mode` in `profiles` + seasonal mode tokens
            # ('pvp_season'/'pve_season') from EFT 1.1.0.0's seasonal characters.
            'profileModes',
            # `inRaid`/`died` below, plus the guarantee that a dead player's
            # position is cleared at death (not just raid end) and spectator
            # screenshots are never served as positions.
            'spectateGate',
            # GET /snip reads the clipboard image ON DEMAND, OCRs it, and
            # returns a nickname - for looking up who killed you.
            'clipboardSnip',
            # `clipSeq` in /status: Windows' clipboard CHANGE COUNTER (a
            # number, never content), so the site can ask /snip only when a
            # fresh snip actually exists.
            'clipSeq',
            # GET /open-profile?id=&mode= opens a tarkov.dev PLAYER PAGE in
            # the default browser. Takes an account id, never a URL. Exists
            # because the site's own tab-open happens off a background check
            # and browsers block that as a popup.
            'openProfile'
        )
        clipSeq          = Get-ClipboardSequence
        raidLocation     = $script:State.RaidLocation
        inRaid           = [bool]$script:State.InRaid
        # True from the moment the local player dies (spectating a teammate)
        # until the raid ends. While true, `position` is null by construction.
        died             = [bool]$script:State.DiedInRaid
        raids            = @($script:State.Raids.ToArray())
        # Every profile, not just the active one - lets the site show PvE and
        # PvP side by side without a second request.
        profiles         = $profiles
        # `screenshotsDir` stays singular for older readers: the first folder
        # that actually exists (else the first candidate). The full watch list
        # is new in `screenshotsDirs`.
        screenshotsDir   = [string]($(
            $existing = @($script:State.ScreenshotsDirs | Where-Object { Test-Path -LiteralPath $_ -PathType Container })
            if ($existing.Count -gt 0) { $existing[0] } elseif ($script:State.ScreenshotsDirs.Count -gt 0) { $script:State.ScreenshotsDirs[0] } else { '' }
        ))
        screenshotsDirExists = [bool](@($script:State.ScreenshotsDirs | Where-Object { Test-Path -LiteralPath $_ -PathType Container }).Count -gt 0)
        screenshotsDirs  = @($script:State.ScreenshotsDirs)
        sessionsSeen     = $script:State.SessionsSeen
        # Lets the site say "the companion is up but your browser never reached
        # it" instead of the same "Not running" it shows for a dead port.
        requestsServed   = $script:State.RequestCount
        allowedOrigins   = @($script:State.AllowedOrigins.ToArray())
        rejectedOrigins  = @($script:State.RejectedOrigins.ToArray())
        # True while past sessions are still being folded in. Everything above
        # is already usable; it just isn't complete yet.
        backfilling      = ($backfillDone -lt $backfillTotal)
        backfillProgress = [ordered]@{ done = $backfillDone; total = $backfillTotal }
    }
}

# ---------------------------------------------------------------------------
# HTTP bridge (127.0.0.1 only)
#
# A hand-rolled server on a plain TCP socket rather than HttpListener, because
# HttpListener goes through http.sys and needs a URL reservation an ordinary
# user can't always make - which would turn "run this script" into "run this
# script as administrator". A raw loopback socket needs no permission at all.
# ---------------------------------------------------------------------------

# Browser origins allowed to read the bridge (the tracker, local + hosted).
# Anything else is refused, so an unrelated site can't quietly read a visitor's
# game state just because they happen to have the companion running.
$RX_ALLOWED_ORIGIN = [regex]::new(
    '^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https?://([a-z0-9-]+\.)*tarkovguides\.com$', 'IgnoreCase')

# Extra origins for anyone hosting the tracker somewhere else, e.g.
#   setx MTC_ALLOWED_ORIGINS "https://tracker.example.com,http://192.168.1.5:3000"
# Comma-separated, matched exactly (scheme + host + port), case-insensitive.
$EXTRA_ORIGINS = @()
if ($env:MTC_ALLOWED_ORIGINS) {
    $EXTRA_ORIGINS = @($env:MTC_ALLOWED_ORIGINS -split ',' |
            ForEach-Object { $_.Trim().TrimEnd('/').ToLowerInvariant() } |
            Where-Object { $_ })
}

function Test-OriginAllowed([string]$Origin) {
    if (-not $Origin) { return $false }
    if ($RX_ALLOWED_ORIGIN.IsMatch($Origin)) { return $true }
    return ($Origin.TrimEnd('/').ToLowerInvariant() -in $EXTRA_ORIGINS)
}

<#
    Gates whether a request is allowed to actually DO anything (read
    /status or /health, or run /shutdown) - separate from Test-OriginAllowed,
    which only decides whether a response gets an Access-Control-Allow-Origin
    header. That distinction used to not exist: every route ran regardless of
    Origin, so a page an unrelated site loaded in a visitor's browser could
    silently hit /shutdown with a plain `<img>` tag - a "simple" cross-origin
    request browsers send with no permission prompt and no preflight, and one
    whose Origin header the requesting page's own JS can neither read nor
    spoof. Checking that header before running the action - not just before
    deciding whether to let the page read the result - closes that off.

    A request with NO Origin header is treated as trusted, not refused: a
    browser only ever omits Origin for a same-origin/top-level navigation,
    never for the cross-origin fetch/`<img>`/XHR pattern above, and this
    script's own Invoke-WebRequest calls (Open-Bridge's self-upgrade handoff,
    install.ps1, uninstall.ps1) don't send one either - they're not browser
    requests at all, and a process already running locally enough to make one
    already has every capability this endpoint could grant it.
#>
function Test-RequestAllowed([string]$Origin) {
    if (-not $Origin) { return $true }
    return (Test-OriginAllowed $Origin)
}

function Get-CorsHeaders([string]$Origin) {
    $headers = ''
    if (Test-OriginAllowed $Origin) {
        $headers += "Access-Control-Allow-Origin: $Origin`r`n"
        $headers += "Vary: Origin`r`n"
        if (-not $script:State.AllowedOrigins.Contains($Origin)) {
            if ($script:State.AllowedOrigins.Count -ge 10) { $script:State.AllowedOrigins.RemoveAt(0) }
            [void]$script:State.AllowedOrigins.Add($Origin)
        }
    } elseif ($Origin -and -not $script:State.RejectedOrigins.Contains($Origin)) {
        # Recorded so /diag can say which site was turned away - the browser
        # itself reports this as an ordinary failed fetch, indistinguishable
        # from nothing listening at all.
        if ($script:State.RejectedOrigins.Count -ge 10) { $script:State.RejectedOrigins.RemoveAt(0) }
        [void]$script:State.RejectedOrigins.Add($Origin)
    }
    $headers += "Access-Control-Allow-Methods: GET, OPTIONS`r`n"
    $headers += "Access-Control-Allow-Headers: Content-Type`r`n"
    # Private Network Access: lets a public https page (the hosted tracker)
    # reach this loopback server. Chrome/Edge send a preflight carrying
    # `Access-Control-Request-Private-Network`; this grants it.
    $headers += "Access-Control-Allow-Private-Network: true`r`n"
    $headers += "Cache-Control: no-store`r`n"
    return $headers
}

function Send-HttpResponse($Stream, [int]$Code, [string]$Reason, [string]$ContentType, [string]$Body, [string]$Origin) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    $head = "HTTP/1.1 $Code $Reason`r`n"
    $head += (Get-CorsHeaders $Origin)
    if ($ContentType) { $head += "Content-Type: $ContentType`r`n" }
    $head += "Content-Length: $($bytes.Length)`r`n"
    $head += "Connection: close`r`n`r`n"
    $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
    $Stream.Write($headBytes, 0, $headBytes.Length)
    if ($bytes.Length -gt 0) { $Stream.Write($bytes, 0, $bytes.Length) }
    $Stream.Flush()
}

<#
    Plain-text "why isn't this working" page for /diag.

    Opened directly in a browser rather than fetched by the site, so CORS never
    applies and it answers even when the tracker itself is being refused. That
    matters because a browser reports a blocked origin and a dead port
    identically - as a failed fetch - so the site alone can never tell a user
    which of the two they're hitting.
#>
function Get-DiagnosticReport {
    $snap = Get-Snapshot
    $questTotal = 0
    foreach ($v in $snap.questCounts.Values) { $questTotal += $v }
    $lines = New-Object System.Collections.ArrayList
    [void]$lines.AddRange(@(
            "$APP_NAME $COMPANION_VERSION  (PowerShell edition)",
            '',
            'If you can read this, the companion IS running and this machine is',
            'fine. So if the tracker says "Not running", the fault is between the',
            'two - keep reading, the section further down says which.',
            '',
            "Log folder : $(if ($snap.logRoot) { $snap.logRoot } else { 'NOT FOUND - is Escape from Tarkov installed?' })",
            "Session    : $(if ($snap.session) { $snap.session } else { 'none yet - launch the game once' })",
            "Profile    : $(if ($snap.profileId) { $snap.profileId } else { 'none yet' }) ($(if ($snap.mode) { $snap.mode } else { '?' }))",
            "Quests read: $questTotal",
            "Raids read : $($snap.raids.Count)",
            "In raid    : $($snap.inRaid)$(if ($snap.died) { '  (DIED - spectating, position suppressed until raid end)' })",
            "Reading past sessions: $($snap.backfillProgress.done) of $($snap.backfillProgress.total)",
            "Port       : $($script:State.Port)",
            '',
            'Addresses this companion accepts:',
            '  http://localhost:<any port>',
            '  http://127.0.0.1:<any port>',
            '  https://tarkovguides.com and any subdomain of it'
        ))
    foreach ($extra in $EXTRA_ORIGINS) { [void]$lines.Add("  $extra   (from MTC_ALLOWED_ORIGINS)") }
    [void]$lines.Add('')

    # The three states below are genuinely different problems with genuinely
    # different fixes, and they used to all print the same sentence.
    if ($script:State.RejectedOrigins.Count -gt 0) {
        [void]$lines.Add('REFUSED so far - this is almost certainly your problem:')
        foreach ($origin in $script:State.RejectedOrigins) { [void]$lines.Add("  $origin") }
        [void]$lines.Add('')
        [void]$lines.Add('To allow one, set MTC_ALLOWED_ORIGINS and restart the companion:')
        [void]$lines.Add("  setx MTC_ALLOWED_ORIGINS `"$($script:State.RejectedOrigins[$script:State.RejectedOrigins.Count - 1])`"")
    } elseif ($script:State.RequestCount -gt 0) {
        $ago = [int]([Math]::Max(0, (Get-Epoch) - $script:State.LastRequestAt))
        [void]$lines.Add("A website HAS been talking to this companion: $($script:State.RequestCount) requests,")
        [void]$lines.Add("the most recent $ago second(s) ago. Nothing has been refused.")
        foreach ($origin in $script:State.AllowedOrigins) { [void]$lines.Add("  $origin") }
        [void]$lines.Add('')
        [void]$lines.Add('So the connection itself is fine. If the tracker still looks wrong,')
        [void]$lines.Add('the problem is in the page, not here - reload it.')
    } else {
        [void]$lines.AddRange(@(
                'NOTHING HAS EVER ASKED THIS COMPANION FOR ANYTHING.',
                '',
                'That is the finding, and it is a useful one. This companion is',
                'healthy, and nothing has been refused - so the request is not',
                'leaving your browser at all. Nothing you change here will help;',
                'the fix is in the browser.',
                '',
                '--------------------------------------------------------------',
                ' 1. BLOCKED SITE PERMISSION   <- the usual culprit',
                '--------------------------------------------------------------',
                'This is the one that has actually caught people out, and it is',
                'completely silent: no error, no warning, no console message. The',
                'tracker simply says "Not running" forever while this page proves',
                'the companion is fine.',
                '',
                'On the TRACKER tab (not this one):',
                '  a. Click the icon at the very left of the address bar - the',
                '     padlock, sliders, or (i) symbol.',
                '  b. Open Site settings / Permissions.',
                '  c. Find "Apps" (some browsers call it "Open external apps",',
                '     "External protocol handlers", or "Local network access").',
                '  d. If it says Blocked, set it to Allow.',
                '  e. Reload the tracker tab, then refresh this page.',
                '',
                'A "Blocked" here stops the site both from starting the companion',
                'and, in some browsers, from reading it at all.',
                '',
                '--------------------------------------------------------------',
                ' 2. THE TRACKER TAB HAS NOT ASKED YET',
                '--------------------------------------------------------------',
                'The tracker is the only thing that contacts this companion. If it',
                'has not been open since the companion started, this page is simply',
                'telling the truth. Open the tracker, leave it open a few seconds,',
                'then refresh this page - the count above should move.',
                '',
                '--------------------------------------------------------------',
                ' 3. AN EXTENSION IS CANCELLING THE REQUEST',
                '--------------------------------------------------------------',
                'Adblock, privacy and antivirus extensions can quietly drop a',
                'request to a local address. Open the tracker in a private window',
                'with extensions disabled and refresh this page. If the count',
                'moves, an extension is the cause - allowlist the site in it.',
                '',
                '--------------------------------------------------------------',
                ' 4. STILL STUCK',
                '--------------------------------------------------------------',
                "Press F12 on the tracker tab, open the Console, reload, and read",
                'the red error mentioning 127.0.0.1 - it names the exact cause.',
                '',
                "This companion's own log (every startup step that can fail):",
                "  $(Get-LogPath)"
            ))
    }
    return (($lines -join "`r`n") + "`r`n")
}

# ---------------------------------------------------------------------------
# Clipboard snip -> killer nickname (the /snip endpoint)
#
# WHAT THIS IS FOR: after dying, the player snips the killer's name off the
# raid-end screen with Win+Shift+S. That lands on the CLIPBOARD, not on disk,
# so there is no file for the screenshot watcher to pick up. This reads that
# one image, runs it through the OCR engine already built into Windows, and
# returns the nickname for the site to look up.
#
# PRIVACY, because this is the one thing here that touches something outside
# the game: the clipboard is read ONLY when the site asks, by calling this
# endpoint, which happens only when the user presses the button. There is no
# polling, no background watching, and the image is never written anywhere
# except a single temp file that is deleted before this returns. Nothing about
# the clipboard is stored in state, logged, or included in /status.
# ---------------------------------------------------------------------------

# "...(bodypart)" - the anchor that says where the killer's name ENDS on a
# sloppy snip that caught the whole raid-end line.
$RX_KILL_LINE = [regex]::new(
    '(?<pre>[^()]*?)\(\s*(?<part>head|thorax|stomach|left arm|right arm|left leg|right leg)\s*\)',
    'IgnoreCase')

# A two-word "Firstname Lastname" is how EFT names its AI scavs (e.g.
# "Roma Magogi"). Verified against tarkov.dev's full player index: of
# 2,963,313 real nicknames, ZERO contain a space - so a space is the reliable
# tell that this is a bot, not a player, and no profile will ever exist for
# it. That fact is also what makes "take the last token" correct below.
$RX_AI_SCAV_NAME = [regex]::new('^(?<first>[A-Z][a-z]+)\s+(?<last>[A-Z][a-zA-Z\-]+)$')

<#
    OCR an image held in a .NET stream. Returns the recognized text, or $null
    if the engine is unavailable (a Windows install with no OCR language pack).

    Takes a STREAM, not a path, because this feature writes nothing to disk -
    see Get-ClipboardSnip. `AsRandomAccessStream` is what bridges an ordinary
    MemoryStream to the WinRT decoder, so the snip goes clipboard -> memory ->
    OCR without ever becoming a file that would then need cleaning up.
#>
function Read-ImageText($Stream) {
    try {
        $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
                $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
                $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
        function Await($op, $type) {
            $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
            $t.Wait(-1) | Out-Null
            return $t.Result
        }
        [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime] | Out-Null
        [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
        if ($null -eq $engine) { return $null }

        [void]$Stream.Seek(0, [System.IO.SeekOrigin]::Begin)
        $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($Stream)
        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        return (($result.Lines | ForEach-Object { $_.Text }) -join ' ')
    } catch {
        return $null
    }
}

<#
    Pull the killer's name out of whatever the OCR returned.

    Returns @{ nickname; isAi } - or $null when nothing usable is there.

    Two snip shapes have to work, because people aim differently:
      "DaftDrummer"                              - just the name
      "Level 22 - SwagBob X DaftDrummer(thorax)" - the whole kill line

    THE TRAP the second shape sets: that line holds TWO names, the victim's
    and the killer's, separated only by a skull glyph - and the OCR engine
    frequently drops that glyph entirely rather than turning it into junk
    (measured: "Level 2 2 - SwagBob DaftDrummer (thorax) (SKS 26m)"). So the
    two names run together and naively grabbing "the words before (thorax)"
    yields "SwagBob DaftDrummer", which is nobody.

    What resolves it: a real PMC nickname NEVER contains a space (0 of
    2,963,313 in tarkov.dev's index do). So the killer is exactly the LAST
    whitespace-delimited token before the anchor, and anything earlier on the
    line belongs to the victim. A two-word result can only be an AI scav
    ("Roma Magogi"), which is flagged rather than looked up, since bots have
    no profile to find.
#>
function Get-NicknameFromText([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }

    $m = $RX_KILL_LINE.Match($Text)
    if ($m.Success) {
        $pre = $m.Groups['pre'].Value.Trim()
        # Drop the victim's "Level 22 -" prefix if the snip caught it.
        $pre = [regex]::Replace($pre, '^\s*Level\s+[\d\s]+\s*[-–]?\s*', '', 'IgnoreCase').Trim()
        $tokens = @($pre -split '\s+' | Where-Object { $_ })
        return (Select-KillerToken $tokens)
    }

    # No anchor: the snip is assumed to be the name by itself. Strip the skull
    # glyph (it OCRs as "Z"/"2"/nothing) and any trailing parenthetical.
    $t = $Text.Trim()
    $t = [regex]::Replace($t, '\s*\(.*$', '')
    $t = [regex]::Replace($t, '^(?:Level\s+[\d\s]+\s*[-–]\s*)', '', 'IgnoreCase')
    $t = [regex]::Replace($t, '^[^A-Za-z0-9_\[\-]+\s*', '')
    $t = $t.Trim()
    if ($t.Length -lt 2 -or $t.Length -gt 40) { return $null }
    return (Select-KillerToken @($t -split '\s+' | Where-Object { $_ }))
}

<#
    Given the words that precede the "(bodypart)" anchor, decide which of them
    is the killer.

    The last token is the answer for a player, since nicknames can't contain
    spaces. The one exception is an AI scav, whose name is always two plainly
    capitalized words - so the last TWO tokens are checked against that shape
    first. "SwagBob DaftDrummer" (victim + player) deliberately fails that
    check because the internal capitals in each token don't fit
    "Firstname Lastname", while "Roma Magogi" fits exactly. Where that
    heuristic is genuinely ambiguous the server still has the last word: a
    name that resolves in the player index is treated as a player regardless.
#>
function Select-KillerToken($Tokens) {
    if ($null -eq $Tokens -or @($Tokens).Count -eq 0) { return $null }
    $tokens = @($Tokens)
    if ($tokens.Count -ge 2) {
        $pair = "$($tokens[$tokens.Count - 2]) $($tokens[$tokens.Count - 1])"
        if ($RX_AI_SCAV_NAME.IsMatch($pair)) { return @{ nickname = $pair; isAi = $true } }
    }
    $name = [regex]::Replace($tokens[$tokens.Count - 1], '^[^A-Za-z0-9_\[\-]+', '')
    if ($name.Length -lt 2 -or $name.Length -gt 40) { return $null }
    return @{ nickname = $name; isAi = $false }
}

<#
    Read the clipboard image, normalize it, OCR it, and return
    @{ ok; nickname; isAi; text; width; height } - or @{ ok = $false; error }.

    THE SNIP IS ALWAYS SAVED, AND ONLY EVER REMOVED ONCE IT HAS PROVABLY DONE
    ITS JOB. Saving happens here; removal happens only via /snip/confirm, and
    only when the site reports that this exact snip produced a real player
    profile (see Confirm-Snip for the full set of conditions). Anything else -
    an unrelated picture someone copied, the game not running, a misread name,
    a player with no profile - keeps the file. Existing files are never
    overwritten either: a repeat name gets a numbered suffix.

    The scale step matters more than anything else here: measured on real
    raid-end screenshots, a 30px-tall name at 1:1 OCRs to NOTHING, the same
    crop at 3x reads perfectly, and a 4K crop blown up 4x starts garbling
    ("Roma Magog("). Normalizing the height to ~100px put every sample in the
    range that reads cleanly regardless of the player's resolution.
#>
<#
    Is Escape from Tarkov actually running right now?

    Gates snip deletion: a clipboard image captured while the game isn't even
    open is almost certainly not a raid-end screen - it's whatever the person
    was doing on their PC - and must never be deleted no matter what the OCR
    happened to make of it.
#>
<#
    Windows' global clipboard sequence number: a counter the OS bumps on every
    clipboard change. This reads NO clipboard content - it is the signal the
    site's profile-search option watches (in /status, which it already polls)
    to know a fresh snip exists before it asks /snip to read one, so the
    clipboard image itself is still only ever read on an explicit /snip. The
    P/Invoke type compiles once per process; any failure reports 0, which the
    site treats as "no signal" rather than an error.
#>
function Get-ClipboardSequence {
    try {
        if (-not ('MasterTarkov.ClipSeq' -as [type])) {
            Add-Type -Namespace MasterTarkov -Name ClipSeq -ErrorAction Stop -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();'
        }
        return [long][MasterTarkov.ClipSeq]::GetClipboardSequenceNumber()
    } catch { return 0 }
}

function Test-EftRunning {
    foreach ($name in @('EscapeFromTarkov', 'EscapeFromTarkov_BE')) {
        try {
            if (Get-Process -Name $name -ErrorAction SilentlyContinue) { return $true }
        } catch { }
    }
    return $false
}

<#
    Save a snip to $SNIP_DIR and return its full path (or $null if it could
    not be written - a failure to save must never lose the OCR result that
    came with it).

    Named "<date>_<time>_<name>.png" so the folder reads as a history of who
    killed you. An existing file is NEVER overwritten: a collision takes a
    numbered suffix instead, because the older snip is somebody's kept
    screenshot and destroying it is exactly what this feature must not do.
#>
function Save-Snip($Bitmap, [string]$Name) {
    try {
        if (-not (Test-Path -LiteralPath $SNIP_DIR -PathType Container)) {
            New-Item -ItemType Directory -Path $SNIP_DIR -Force -ErrorAction Stop | Out-Null
        }
        $safe = [regex]::Replace($Name, '[^A-Za-z0-9_\-\. ]', '_')
        if ([string]::IsNullOrWhiteSpace($safe)) { $safe = 'unreadable' }
        $stamp = (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')
        $path = Join-Path $SNIP_DIR "${stamp}_${safe}.png"
        $n = 2
        while (Test-Path -LiteralPath $path) {
            $path = Join-Path $SNIP_DIR "${stamp}_${safe}-${n}.png"
            $n++
        }
        $Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-CompanionLog "snip saved: $path"
        return $path
    } catch {
        Write-CompanionLog "could not save snip: $($_.Exception.Message)"
        return $null
    }
}

<#
    Forget snips this session is no longer expecting a verdict on.

    Only the BOOKKEEPING is dropped - the files themselves stay on disk. That
    asymmetry is the point: forgetting an entry can only ever mean a snip is
    kept forever, never that one is removed by accident.
#>
function Remove-OldPendingSnips {
    $ids = @($script:State.PendingSnips.Keys)
    if ($ids.Count -le $MAX_PENDING_SNIPS) { return }
    $oldest = @($ids | Sort-Object { $script:State.PendingSnips[$_].at }) |
        Select-Object -First ($ids.Count - $MAX_PENDING_SNIPS)
    foreach ($id in $oldest) { $script:State.PendingSnips.Remove($id) }
}

<#
    The site confirming that a snip did its job - the ONLY path by which a
    snip is ever deleted.

    Every one of these must hold, or the file stays:
      1. The id is one this companion issued for a snip it saved itself. The
         caller never names a path, so a page cannot ask for the deletion of
         anything else on the machine.
      2. Escape from Tarkov was running when the snip was taken. A clipboard
         image captured with the game closed is someone's unrelated picture.
      3. The site reports a real player profile came back from it. A misread
         name, an AI scav, or a player with no profile all mean the snip
         still has value - keeping it is how a bad read stays diagnosable.
      4. The file still sits inside $SNIP_DIR. Belt and braces against a
         recorded path having been tampered with.
#>
function Confirm-Snip([string]$Id, [bool]$Matched) {
    if (-not $Id -or -not $script:State.PendingSnips.ContainsKey($Id)) {
        return @{ ok = $false; deleted = $false; reason = 'unknown snip id' }
    }
    $entry = $script:State.PendingSnips[$Id]

    if (-not $Matched) {
        return @{ ok = $true; deleted = $false; reason = 'no profile matched - snip kept' }
    }
    if (-not $entry.eftRunning) {
        return @{ ok = $true; deleted = $false; reason = 'Tarkov was not running when this was taken - snip kept' }
    }

    $full = [System.IO.Path]::GetFullPath($entry.path)
    $root = [System.IO.Path]::GetFullPath($SNIP_DIR)
    if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        return @{ ok = $false; deleted = $false; reason = 'snip is outside the snips folder - kept' }
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        $script:State.PendingSnips.Remove($Id)
        return @{ ok = $true; deleted = $false; reason = 'already gone' }
    }

    try {
        Remove-Item -LiteralPath $full -Force -ErrorAction Stop
        $script:State.PendingSnips.Remove($Id)
        Write-CompanionLog "snip used successfully, removed: $full"
        return @{ ok = $true; deleted = $true; reason = 'used successfully' }
    } catch {
        return @{ ok = $false; deleted = $false; reason = "could not remove: $($_.Exception.Message)" }
    }
}

function Get-ClipboardSnip {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        Add-Type -AssemblyName System.Drawing -ErrorAction Stop
        Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
    } catch {
        return @{ ok = $false; error = 'clipboard/OCR assemblies unavailable' }
    }

    $image = $null
    try {
        if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) {
            return @{ ok = $false; error = 'no image on the clipboard - snip the killer name with Win+Shift+S first' }
        }
        $image = [System.Windows.Forms.Clipboard]::GetImage()
    } catch {
        # Clipboard needs an STA thread; a non-STA host throws here rather
        # than returning nothing, and the message is the useful part.
        return @{ ok = $false; error = "clipboard unreadable: $($_.Exception.Message)" }
    }
    if ($null -eq $image) { return @{ ok = $false; error = 'clipboard image could not be read' } }

    $srcW = $image.Width
    $srcH = $image.Height
    $scaled = $null
    $memory = $null
    try {
        $scale = [Math]::Max(1.0, [Math]::Min(6.0, $SNIP_TARGET_HEIGHT / [double]$srcH))
        $w = [int][Math]::Round($srcW * $scale)
        $h = [int][Math]::Round($srcH * $scale)
        $scaled = New-Object System.Drawing.Bitmap($w, $h)
        $g = [System.Drawing.Graphics]::FromImage($scaled)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($image, 0, 0, $w, $h)
        $g.Dispose()

        # Encoded in memory and handed straight to the OCR engine.
        $memory = New-Object System.IO.MemoryStream
        $scaled.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)

        $text = Read-ImageText $memory
        $parsed = if ($null -eq $text) { $null } else { Get-NicknameFromText $text }

        # Saved even when the read fails - an unreadable snip is exactly the
        # one worth keeping, since it's the evidence for why it failed.
        $saved = Save-Snip $scaled $(if ($null -ne $parsed) { $parsed.nickname } else { 'unreadable' })

        # Recorded so /snip/confirm can later remove THIS file and no other.
        # Whether the game was running is captured now, at the moment of the
        # snip, because that is when it means something.
        $snipId = $null
        if ($saved) {
            $snipId = [guid]::NewGuid().ToString('N')
            $script:State.PendingSnips[$snipId] = @{
                path = $saved; eftRunning = (Test-EftRunning); at = (Get-Epoch)
            }
            Remove-OldPendingSnips
        }

        if ($null -eq $text) {
            return @{ ok = $false; error = 'no OCR engine available for your Windows language'; savedTo = $saved; snipId = $snipId }
        }
        if ($null -eq $parsed) {
            return @{ ok = $false; error = 'no name found in that snip'; text = $text; savedTo = $saved; snipId = $snipId }
        }
        return @{
            ok = $true; nickname = $parsed.nickname; isAi = [bool]$parsed.isAi
            text = $text; width = $srcW; height = $srcH; savedTo = $saved; snipId = $snipId
        }
    } catch {
        return @{ ok = $false; error = "snip failed: $($_.Exception.Message)" }
    } finally {
        # Only in-memory objects are released here - the saved snip stays.
        if ($null -ne $memory) { try { $memory.Dispose() } catch { } }
        if ($null -ne $scaled) { try { $scaled.Dispose() } catch { } }
        if ($null -ne $image) { try { $image.Dispose() } catch { } }
    }
}

function Invoke-Request($Client) {
    try {
        $Client.ReceiveTimeout = 3000
        $Client.SendTimeout = 3000
        $stream = $Client.GetStream()
        $stream.ReadTimeout = 3000

        $buffer = New-Object byte[] 8192
        $raw = ''
        while ($true) {
            $read = $stream.Read($buffer, 0, $buffer.Length)
            if ($read -le 0) { break }
            $raw += [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
            if ($raw.Contains("`r`n`r`n")) { break }
            if ($raw.Length -gt 16384) { break }
        }
        if (-not $raw) { return }

        $lines = $raw -split "`r`n"
        $parts = $lines[0] -split ' '
        $method = $parts[0]
        $target = if ($parts.Count -gt 1) { $parts[1] } else { '/' }
        $origin = ''
        foreach ($line in $lines) {
            if ($line -imatch '^Origin:\s*(.+)$') { $origin = $Matches[1].Trim(); break }
        }

        $script:State.LastContact = Get-Epoch
        $path = (($target -split '\?', 2)[0]).TrimEnd('/')
        # Counted before the response so /diag can prove something reached it.
        # /diag itself doesn't count - opening it by hand isn't the tracker.
        if ($path -ne '/diag') {
            $script:State.RequestCount++
            $script:State.LastRequestAt = $script:State.LastContact
        }

        if ($method -eq 'OPTIONS') {
            Send-HttpResponse $stream 204 'No Content' '' '' $origin
            return
        }
        if ($method -ne 'GET') {
            Send-HttpResponse $stream 405 'Method Not Allowed' 'application/json' '{"error":"method not allowed"}' $origin
            return
        }

        switch ($path) {
            { $_ -in @('', '/status') } {
                if (-not (Test-RequestAllowed $origin)) {
                    Send-HttpResponse $stream 403 'Forbidden' 'application/json' '{"error":"forbidden"}' $origin
                    break
                }
                # `?slim=1` drops the raid history. Measured on a real
                # install: the full snapshot is ~143 KB, of which ~128 KB
                # (90%) is `raids` - 500 finished raids that cannot change
                # while the player is standing in one, re-serialized, re-sent
                # and re-parsed on EVERY poll, to carry a 93-byte position.
                # The tracker asks for slim; the full payload stays the
                # default so anything else reading /status is unaffected.
                $snapshot = Get-Snapshot
                if ($target -imatch '[?&]slim=1\b') { $snapshot.Remove('raids') }
                $json = ConvertTo-Json $snapshot -Depth 20 -Compress
                Send-HttpResponse $stream 200 'OK' 'application/json' $json $origin
                break
            }
            '/health' {
                if (-not (Test-RequestAllowed $origin)) {
                    Send-HttpResponse $stream 403 'Forbidden' 'application/json' '{"error":"forbidden"}' $origin
                    break
                }
                $json = ConvertTo-Json ([ordered]@{ app = $APP_NAME; version = $COMPANION_VERSION; ok = $true }) -Compress
                Send-HttpResponse $stream 200 'OK' 'application/json' $json $origin
                break
            }
            '/diag' {
                # Deliberately NOT gated by Test-RequestAllowed - see this
                # function's own doc comment above: opened directly in a
                # browser tab (no Origin header on a top-level navigation)
                # specifically so it still answers when the tracker itself
                # is being refused, which is exactly the case it exists to
                # diagnose.
                Send-HttpResponse $stream 200 'OK' 'text/plain; charset=utf-8' (Get-DiagnosticReport) $origin
                break
            }
            '/snip' {
                if (-not (Test-RequestAllowed $origin)) {
                    Send-HttpResponse $stream 403 'Forbidden' 'application/json' '{"error":"forbidden"}' $origin
                    break
                }
                # On-demand only: nothing here runs unless the site asks.
                $snip = Get-ClipboardSnip
                $payload = [ordered]@{
                    app      = $APP_NAME
                    version  = $COMPANION_VERSION
                    ok       = [bool]$snip.ok
                    nickname = $(if ($snip.ok) { [string]$snip.nickname } else { $null })
                    # True when the name is a two-word AI scav ("Roma Magogi"),
                    # which has no profile to look up - the site says so
                    # instead of reporting a failed player search.
                    isAi     = [bool]$snip.isAi
                    text     = $(if ($snip.ContainsKey('text')) { [string]$snip.text } else { $null })
                    # Where the snip was kept. Every snip is saved and none is
                    # ever deleted, so this path stays valid.
                    savedTo  = $(if ($snip.ContainsKey('savedTo')) { [string]$snip.savedTo } else { $null })
                    # Hand back to /snip/confirm to report whether this snip
                    # actually produced a profile. Without that call the snip
                    # is simply kept.
                    snipId   = $(if ($snip.ContainsKey('snipId')) { [string]$snip.snipId } else { $null })
                    error    = $(if ($snip.ok) { $null } else { [string]$snip.error })
                }
                Send-HttpResponse $stream 200 'OK' 'application/json' (ConvertTo-Json $payload -Compress) $origin
                break
            }
            '/snip/confirm' {
                if (-not (Test-RequestAllowed $origin)) {
                    Send-HttpResponse $stream 403 'Forbidden' 'application/json' '{"error":"forbidden"}' $origin
                    break
                }
                # ?id=<the id /snip returned>&matched=1 when a real profile
                # came back. Only that combination can remove a snip.
                $snipId = ''
                if ($target -imatch '[?&]id=([A-Za-z0-9]+)') { $snipId = $Matches[1] }
                $matched = [bool]($target -imatch '[?&]matched=1\b')
                $outcome = Confirm-Snip $snipId $matched
                $json = ConvertTo-Json ([ordered]@{
                        app     = $APP_NAME
                        ok      = [bool]$outcome.ok
                        deleted = [bool]$outcome.deleted
                        reason  = [string]$outcome.reason
                    }) -Compress
                Send-HttpResponse $stream 200 'OK' 'application/json' $json $origin
                break
            }
            '/open-profile' {
                if (-not (Test-RequestAllowed $origin)) {
                    Send-HttpResponse $stream 403 'Forbidden' 'application/json' '{"error":"forbidden"}' $origin
                    break
                }
                # Opens a tarkov.dev player page in the default browser.
                #
                # WHY THE COMPANION DOES THIS AT ALL: the site learns who
                # killed you from a background clipboard check, so its
                # window.open has no click behind it and browsers block it as
                # a popup. A local process asking Windows to open a link is
                # not a popup, so this is the one path that reliably works.
                #
                # WHY IT CANNOT BE TURNED INTO "OPEN ANYTHING": no URL is
                # accepted. The caller sends an account id and a game mode;
                # both are validated against strict patterns and the address
                # is built HERE from a hardcoded tarkov.dev template. There is
                # no input that makes this open another site, a file, or a
                # program - the worst a page can do is show a player profile.
                # Mode is matched against tarkov.dev's own four tab slugs and
                # nothing else - an unrecognized one becomes the fallback
                # rather than being passed through. Their stats differ per
                # mode, so this is what makes the killer's page open on the
                # tab for the raid you were actually in (seasonal included).
                # Fallback is the season tab per the site's own default: while
                # a season is running that's what's being played.
                $accountId = ''
                if ($target -imatch '[?&]id=(\d{1,20})(?:&|$)') { $accountId = $Matches[1] }
                $gameMode = 'pvp-season'
                if ($target -imatch '[?&]mode=(regular|pve|pvp-season|arena)(?:&|$)') { $gameMode = $Matches[1] }

                if (-not $accountId) {
                    Send-HttpResponse $stream 400 'Bad Request' 'application/json' '{"ok":false,"error":"id must be digits"}' $origin
                    break
                }
                $url = "https://tarkov.dev/players/$gameMode/$accountId"
                $opened = $false
                try {
                    Start-Process $url
                    $opened = $true
                    Write-CompanionLog "opened profile: $url"
                } catch {
                    Write-CompanionLog "could not open profile: $($_.Exception.Message)"
                }
                $json = ConvertTo-Json ([ordered]@{
                        app  = $APP_NAME
                        ok   = $opened
                        url  = $url
                    }) -Compress
                Send-HttpResponse $stream 200 'OK' 'application/json' $json $origin
                break
            }
            '/shutdown' {
                if (-not (Test-RequestAllowed $origin)) {
                    Send-HttpResponse $stream 403 'Forbidden' 'application/json' '{"error":"forbidden"}' $origin
                    break
                }
                Send-HttpResponse $stream 200 'OK' 'application/json' '{"ok":true,"stopping":true}' $origin
                $script:State.Running = $false
                break
            }
            default {
                Send-HttpResponse $stream 404 'Not Found' 'application/json' '{"error":"not found"}' $origin
            }
        }
    } catch {
        # A browser that navigates away mid-poll resets the connection. Expected,
        # not a fault.
    } finally {
        try { $Client.Close() } catch { }
    }
}

# Ask whatever holds $Port who it is. $null if it isn't us / doesn't answer.
function Test-ExistingCompanion([int]$Port) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://${BIND_HOST}:$Port/health" -TimeoutSec 2
        $payload = ConvertFrom-Json $response.Content
        if ($payload.app -eq $APP_NAME) { return $payload }
    } catch { }
    return $null
}

function ConvertTo-VersionTuple([string]$Raw) {
    try { return [version]($Raw -replace '[^\d.]', '') } catch { return [version]'0.0' }
}

function Start-TcpListener([int]$Port) {
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $listener
    } catch {
        return $null
    }
}

<#
    Claim a port, working around whatever else is already on this machine.

    For each candidate port, if binding fails, ask who's there:
      - Not us         -> some other program; try the next port.
      - Us, older      -> ask it to quit and take over, so an update actually
                          applies instead of losing to the copy already running.
      - Us, same/newer -> it's already doing this job; stand down.

    The website probes the same short range, so a non-default port still gets
    found without anyone configuring anything.
#>
function Open-Bridge {
    foreach ($port in $PORT_CANDIDATES) {
        $listener = Start-TcpListener $port
        if ($listener) { return @{ listener = $listener; port = $port } }

        $existing = Test-ExistingCompanion $port
        if ($null -eq $existing) { continue }   # somebody else's program - leave it alone
        if ((ConvertTo-VersionTuple $existing.version) -ge (ConvertTo-VersionTuple $COMPANION_VERSION)) {
            return $null   # an equal-or-newer copy is already serving
        }
        try { Invoke-WebRequest -UseBasicParsing -Uri "http://${BIND_HOST}:$port/shutdown" -TimeoutSec 2 | Out-Null } catch { }
        for ($i = 0; $i -lt 20; $i++) {
            Start-Sleep -Milliseconds 250
            $listener = Start-TcpListener $port
            if ($listener) { return @{ listener = $listener; port = $port } }
        }
    }
    return $null
}

# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

$RUN_KEY = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'

<#
    Register the masttarkov:// handler so the website can start this on demand,
    and clear any leftover start-with-Windows entry from an older build.

    Deliberately NOT registered to start with Windows. A `...\CurrentVersion\Run`
    entry alongside a self-installing program is the single most malware-shaped
    thing a small unsigned tool can do, and antivirus behaviour monitoring
    quarantined an earlier build minutes after install because of it. Opening
    the tracker is the only time this is needed, and the protocol handler covers
    exactly that.

    Writes only under HKEY_CURRENT_USER, so it needs no administrator rights,
    and is entirely best-effort: a locked-down machine that refuses the writes
    still gets a working companion for this session.
#>
function Register-Companion {
    try {
        if (Get-ItemProperty -LiteralPath $RUN_KEY -Name $APP_NAME -ErrorAction SilentlyContinue) {
            Remove-ItemProperty -LiteralPath $RUN_KEY -Name $APP_NAME -ErrorAction SilentlyContinue
            Write-CompanionLog 'removed leftover start-with-Windows entry from an older version'
        }
    } catch { }

    # The launcher is what the protocol points at, so the site never sees a
    # console window flash.
    #
    # It is resolved against the INSTALL directory, not against wherever this
    # script happens to be running from. Registering the running location
    # sounds equivalent and isn't: run this copy once from a temp folder (a
    # download, an unpacked zip, a diagnostic run) and the handler is left
    # pointing into a directory Windows will happily delete. Every later
    # "start the companion" from the site then pops a Windows Script Host
    # "Can not find script file" dialog, permanently, with nothing on screen
    # to connect it to this app - confirmed on a real machine, where a
    # throwaway run out of a temp folder hijacked the protocol.
    #
    # A run from outside the install directory therefore leaves the existing
    # registration alone rather than repointing it at itself.
    $dir = Get-InstallDir
    $installed = Join-Path $dir 'companion.ps1'
    $runningFromInstall = $PSCommandPath -and
        ((Split-Path -Parent $PSCommandPath).TrimEnd('\') -ieq $dir.TrimEnd('\'))
    if (-not $runningFromInstall -and -not (Test-Path -LiteralPath $installed)) {
        Write-CompanionLog "running from $(Split-Path -Parent $PSCommandPath) with no installed copy - leaving the masttarkov:// handler alone"
        return
    }
    $launcher = Join-Path $dir 'launch.vbs'
    if (-not (Test-Path -LiteralPath $launcher)) {
        try { Write-Launcher $launcher } catch { }
    }

    try {
        $base = "HKCU:\Software\Classes\$PROTOCOL"
        New-Item -Path "$base\shell\open\command" -Force | Out-Null
        Set-ItemProperty -LiteralPath $base -Name '(Default)' -Value 'URL:MasterTarkov Companion'
        Set-ItemProperty -LiteralPath $base -Name 'URL Protocol' -Value ''
        # Both branches name the installed copy, for the same reason the
        # launcher above does - never a path that only exists for this run.
        $command = if (Test-Path -LiteralPath $launcher) {
            "wscript.exe `"$launcher`" `"%1`""
        } else {
            "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installed`""
        }
        Set-ItemProperty -LiteralPath "$base\shell\open\command" -Name '(Default)' -Value $command
    } catch {
        Write-CompanionLog "could not register the masttarkov:// handler: $($_.Exception.Message)"
    }
}

# The three lines that start this script with no window. Resolves the script
# path from its own location, so moving the folder doesn't break it.
function Write-Launcher([string]$Path) {
    $vbs = @'
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & dir & "\companion.ps1""", 0, False
'@
    Set-Content -LiteralPath $Path -Value $vbs -Encoding ASCII
}

function Unregister-Companion {
    try { Remove-ItemProperty -LiteralPath $RUN_KEY -Name $APP_NAME -ErrorAction SilentlyContinue } catch { }
    try { Remove-Item -LiteralPath "HKCU:\Software\Classes\$PROTOCOL" -Recurse -Force -ErrorAction SilentlyContinue } catch { }
    # Stop anything still listening, so the folder isn't in use.
    foreach ($port in $PORT_CANDIDATES) {
        try { Invoke-WebRequest -UseBasicParsing -Uri "http://${BIND_HOST}:$port/shutdown" -TimeoutSec 1 | Out-Null } catch { }
    }
    Start-Sleep -Milliseconds 500
    try { Remove-Item -LiteralPath (Get-InstallDir) -Recurse -Force -ErrorAction SilentlyContinue } catch { }
    try { Remove-Item -LiteralPath (Split-Path -Parent (Get-ConfigPath)) -Recurse -Force -ErrorAction SilentlyContinue } catch { }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

function Invoke-Main {
    Write-CompanionLog "--- start v$COMPANION_VERSION (PowerShell $($PSVersionTable.PSVersion)) persist=$Persist"

    if ($Uninstall) {
        Unregister-Companion
        Write-CompanionLog 'uninstalled'
        return
    }

    Register-Companion
    Write-CompanionLog 'registered masttarkov:// protocol (no autostart by design)'

    $root = Find-LogRoot
    Write-CompanionLog "EFT log folder: $(if ($root) { $root } else { 'NOT FOUND' })"
    # If no install is found the companion still starts, so the website gets a
    # clean answer ("no EFT data") instead of a failed connection.
    $script:State.Root = $root
    $script:State.ScreenshotsDirs = Get-ScreenshotsDirs $root
    Write-CompanionLog "watching screenshots in: $($script:State.ScreenshotsDirs -join '; ')"

    $bridge = Open-Bridge
    if ($null -eq $bridge) {
        Write-CompanionLog "could not claim any port of $($PORT_CANDIDATES -join ', ') - another program holds them, or a newer copy is already running"
        return
    }
    $listener = $bridge.listener
    $script:State.Port = $bridge.port
    Write-CompanionLog "listening on http://${BIND_HOST}:$($bridge.port)"

    # Past sessions are folded in one per loop pass, so the bridge answers
    # immediately and simply reports `backfilling: true` until it's caught up.
    $script:State.BackfillQueue = Get-Sessions
    $script:State.SessionsSeen = $script:State.BackfillQueue.Count
    Write-CompanionLog "backfilling $($script:State.BackfillQueue.Count) past sessions"

    $script:State.LastContact = Get-Epoch
    $lastTick = 0.0

    try {
        while ($script:State.Running) {
            # Requests always win: a poll must never wait behind a log read.
            $served = $false
            while ($listener.Pending()) {
                Invoke-Request $listener.AcceptTcpClient()
                $served = $true
                if (-not $script:State.Running) { break }
            }
            if (-not $script:State.Running) { break }

            if (Step-Backfill) { continue }

            $now = Get-Epoch
            if ($now - $lastTick -ge 1.0) {
                $lastTick = $now
                Invoke-MonitorTick
            }

            # Idle shutdown. The companion is only useful while the tracker is
            # open, and the site relaunches it through masttarkov:// whenever it
            # needs it, so there is no reason to sit in memory the rest of the
            # time - and nothing resident means nothing for antivirus to treat
            # as persistence.
            if (-not $Persist -and ($now - $script:State.LastContact) -gt $IDLE_TIMEOUT) {
                Write-CompanionLog "idle for ${IDLE_TIMEOUT}s - shutting down"
                break
            }

            if (-not $served) { Start-Sleep -Milliseconds 50 }
        }
    } finally {
        try { $listener.Stop() } catch { }
    }
    Write-CompanionLog 'stopped'
}

try {
    Invoke-Main | Out-Null
    exit 0
} catch {
    # This runs with no console, so an unhandled error would look exactly like
    # "it just doesn't launch". Write it down before going quiet.
    Write-CompanionLog ("CRASHED: " + $_.Exception.ToString() + "`n" + $_.ScriptStackTrace)
    exit 1
}
