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
$COMPANION_VERSION = '2.1.7'
$PROTOCOL = 'masttarkov'

$BIND_HOST = '127.0.0.1'
$BASE_PORT = [int]$(if ($env:MTC_PORT) { $env:MTC_PORT } else { 47800 })
# Fallbacks for when something unrelated already owns the preferred port. The
# website probes this same short list, so a machine that has to fall back still
# connects with nothing to configure.
#
# Every term is coerced through [int]: with a non-scalar $BASE_PORT, `+ 1`
# would be ARRAY APPEND, not addition - observed live as a candidate list of
# "47800, 47800, 1, 47800, 2, 47800, 3", after which an instance genuinely
# bound and served on port 1 (Windows happily allows low loopback ports).
# The range guard below is the second line of defence for the same failure.
$PORT_CANDIDATES = @([int]$BASE_PORT, [int]$BASE_PORT + 1, [int]$BASE_PORT + 2, [int]$BASE_PORT + 3) |
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

$NOTIF_MARKER = 'Got notification | ChatMessageReceived'
$QUEST_STATUS = @{ 10 = 'started'; 11 = 'failed'; 12 = 'finished' }

# In-raid screenshots embed the player's world position + view rotation in the
# filename, e.g.
#   2024-01-15[14-30]_-45.67, 120.89, 230.45_0.70, 0.00, 0.70, 0.00 (1).png
# Groups: x, y, z (position) then rx, ry, rz, rw (rotation quaternion).
$RX_SHOT = [regex]::new(
    '_(?<x>-?\d+\.\d+), (?<y>-?\d+\.\d+), (?<z>-?\d+\.\d+)_' +
    '(?<rx>-?\d+\.\d+), (?<ry>-?\d+\.\d+), (?<rz>-?\d+\.\d+), (?<rw>-?\d+\.\d+)')

# Compass heading in degrees from the screenshot's rotation quaternion.
function Get-YawFromQuaternion([double]$rx, [double]$ry, [double]$rz, [double]$rw) {
    $sinyCosp = 2.0 * ($rw * $rz + $rx * $ry)
    $cosyCosp = 1.0 - 2.0 * ($ry * $ry + $rz * $rz)
    return ([Math]::Atan2($sinyCosp, $cosyCosp) * 180.0 / [Math]::PI)
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

# Ordered [taskId, status] quest events from a push-notifications log.
function ConvertFrom-QuestLog([string]$Text) {
    $events = New-Object System.Collections.ArrayList
    if (-not $Text) { return $events }
    $idx = 0
    while ($true) {
        $hit = $Text.IndexOf($NOTIF_MARKER, $idx, [System.StringComparison]::Ordinal)
        if ($hit -lt 0) { break }
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
        if ($taskId) { [void]$events.Add(@($taskId, $status)) }
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
    ActiveProfile     = $null
    ActiveMode        = $null
    ActiveSession     = $null
    GameVersion       = $null
    QuestsAvailable   = $false
    Revision          = 0        # bumps whenever anything changes
    UpdatedAt         = 0.0
    Position          = $null    # @{x; z; yaw; at; map}
    PositionRevision  = 0
    RaidLocation      = $null    # internal map id of the current/most recent raid
    Raids             = (New-Object System.Collections.ArrayList)
    SeenShots         = @{}
    # Folders whose pre-existing screenshots have been fenced off as
    # untouchable (see Update-ScreenshotsIn's priming pass).
    ShotsPrimed       = @{}
    AppSize           = -1
    NotifSize         = -1
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

function Get-Sessions {
    if (-not $script:State.Root -or -not (Test-Path -LiteralPath $script:State.Root -PathType Container)) { return @() }
    try {
        return @(Get-ChildItem -LiteralPath $script:State.Root -Directory -Filter 'log_*' -ErrorAction Stop |
                Sort-Object LastWriteTime)
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
    $app = Get-SessionFile $Session 'application'
    if ($app) {
        $appText = Read-LogText $app.FullName
        $parsed = ConvertFrom-ApplicationLog $appText
        $profileId = $parsed.profileId
        $mode = $parsed.mode
        foreach ($raid in ConvertFrom-RaidLog $appText) {
            $raid.mode = $mode
            $raid.profileId = $profileId
            # Which session log this raid was read from. The live session is
            # re-read as it grows (see Update-ActiveSession), and replaces its
            # own raids by this tag rather than appending duplicates.
            $raid.session = $Session.Name
            [void]$script:State.Raids.Add($raid)
        }
    }

    $key = if ($profileId) { $profileId } else { '_unknown' }
    if (-not $script:State.QuestsByProfile.ContainsKey($key)) { $script:State.QuestsByProfile[$key] = @{} }
    $questState = $script:State.QuestsByProfile[$key]

    $notif = Get-SessionFile $Session 'push-notifications'
    if ($notif) {
        $script:State.QuestsAvailable = $true
        foreach ($evt in ConvertFrom-QuestLog (Read-LogText $notif.FullName)) {
            $questState[$evt[0]] = $evt[1]
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
        # A new game session hasn't entered a raid yet - don't let the previous
        # session's map tag the next screenshot, and don't keep serving a
        # position from a raid that ended when the game was closed.
        $script:State.RaidLocation = $null
        if ($null -ne $script:State.Position) {
            $script:State.Position = $null
            $script:State.PositionRevision++
        }
    }

    $changed = $switched
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
            if ($script:State.Raids.Count -gt 0) {
                $kept = @($script:State.Raids.ToArray() | Where-Object { $_.session -ne $newest.Name })
                $script:State.Raids = New-Object System.Collections.ArrayList
                if ($kept.Count -gt 0) { [void]$script:State.Raids.AddRange($kept) }
            }
            foreach ($raid in $sessionRaids) {
                $raid.mode = $parsed.mode
                $raid.profileId = $parsed.profileId
                $raid.session = $newest.Name
                [void]$script:State.Raids.Add($raid)
            }
            # The map tag for the next screenshot: this session's most recent
            # raid. Derived from the raids just parsed rather than a second
            # scan of the same (up to 12MB) text - same value either way, since
            # both read the last `Location:` line.
            if ($sessionRaids.Count -gt 0) {
                $script:State.RaidLocation = ($sessionRaids | Select-Object -Last 1).map
            }
            # A raid with an end marker means the player is back in the menu -
            # dead or extracted, they are no longer standing at the captured
            # position, so stop serving it. The site then stops drawing their
            # marker, and (via the null presence publish) removes it from
            # every teammate's map too. Position lives only while the newest
            # raid is still open; a screenshot backlog read after a raid ends
            # may flash once and is wiped on the next log growth, which is
            # correct - it is a stale position by definition.
            $lastRaid = if ($sessionRaids.Count -gt 0) { $sessionRaids | Select-Object -Last 1 } else { $null }
            $inRaid = ($null -ne $lastRaid) -and (-not $lastRaid.endedAt)
            if (-not $inRaid -and $null -ne $script:State.Position) {
                $script:State.Position = $null
                $script:State.PositionRevision++
                Set-Changed
                Write-CompanionLog 'raid over - cleared last position'
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

    $notif = Get-SessionFile $newest 'push-notifications'
    if ($notif) {
        $script:State.QuestsAvailable = $true
        $size = $notif.Length
        if ($size -ne $script:State.NotifSize) {
            $script:State.NotifSize = $size
            $key = if ($script:State.ActiveProfile) { $script:State.ActiveProfile } else { '_unknown' }
            if (-not $script:State.QuestsByProfile.ContainsKey($key)) { $script:State.QuestsByProfile[$key] = @{} }
            $questState = $script:State.QuestsByProfile[$key]
            foreach ($evt in ConvertFrom-QuestLog (Read-LogText $notif.FullName)) {
                $questState[$evt[0]] = $evt[1]
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
        foreach ($shot in $shots) { $script:State.SeenShots[$shot.FullName] = $true }
        return
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
        # `map` is the raid this shot came from. Without it the site can't tell
        # which map the coordinates belong to and refuses to draw them.
        $script:State.Position = @{
            x   = $parsed.x
            z   = $parsed.z
            yaw = $parsed.yaw
            at  = Get-Epoch
            map = $script:State.RaidLocation
        }
        $script:State.PositionRevision++
        Set-Changed
        if ($DELETE_SCREENSHOTS) {
            try { Remove-Item -LiteralPath $shot.FullName -Force -ErrorAction Stop }
            catch { $script:State.SeenShots[$shot.FullName] = $true }
        } else {
            $script:State.SeenShots[$shot.FullName] = $true
        }
    }
}

function Invoke-MonitorTick {
    try { Update-ActiveSession } catch { }   # a transient read error must never kill the loop
    try { Update-Screenshots } catch { }
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
            'raids', 'allProfiles', 'diag', 'backfill'
        )
        raidLocation     = $script:State.RaidLocation
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
    '^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https?://([a-z0-9-]+\.)*odqum\.com$', 'IgnoreCase')

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
            "Reading past sessions: $($snap.backfillProgress.done) of $($snap.backfillProgress.total)",
            "Port       : $($script:State.Port)",
            '',
            'Addresses this companion accepts:',
            '  http://localhost:<any port>',
            '  http://127.0.0.1:<any port>',
            '  https://odqum.com and any subdomain of it'
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
                $json = ConvertTo-Json (Get-Snapshot) -Depth 20 -Compress
                Send-HttpResponse $stream 200 'OK' 'application/json' $json $origin
                break
            }
            '/health' {
                $json = ConvertTo-Json ([ordered]@{ app = $APP_NAME; version = $COMPANION_VERSION; ok = $true }) -Compress
                Send-HttpResponse $stream 200 'OK' 'application/json' $json $origin
                break
            }
            '/diag' {
                Send-HttpResponse $stream 200 'OK' 'text/plain; charset=utf-8' (Get-DiagnosticReport) $origin
                break
            }
            '/shutdown' {
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
