$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "This update procedure must run on Windows."
}

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ExpectedOrigin = "https://github.com/North3rnLight3r/FORGE"
Set-Location -LiteralPath $RepositoryRoot

foreach ($RequiredFile in @("scripts\package-windows.ps1", "scripts\install-windows.ps1")) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $RequiredFile) -PathType Leaf)) {
        throw "Required Windows update procedure is missing: $RequiredFile"
    }
}

if ((git branch --show-current) -ne "main") { throw "FORGE must be on main before updating." }
$Origin = (git config --get remote.origin.url).TrimEnd("/")
if ($Origin.EndsWith(".git")) { $Origin = $Origin.Substring(0, $Origin.Length - 4) }
if ($Origin -ne $ExpectedOrigin) { throw "FORGE has an untrusted origin: $Origin" }
$SourceChanges = @(git status --porcelain -- "." ":(exclude).obsidian/**")
if ($SourceChanges.Count -gt 0) { throw "FORGE has source changes outside .obsidian; refusing to update." }

$Before = (git rev-parse HEAD).Trim()
$ObsidianStashed = $false
$Succeeded = $false
try {
    $ObsidianChanges = @(git status --porcelain -- ".obsidian")
    if ($ObsidianChanges.Count -gt 0) {
        git stash push --include-untracked --message "FORGE Windows updater local Obsidian state" -- ".obsidian" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not preserve local Obsidian state." }
        $ObsidianStashed = $true
    }

    git fetch --prune origin main
    if ($LASTEXITCODE -ne 0) { throw "Could not fetch origin/main." }
    git merge-base --is-ancestor HEAD origin/main
    if ($LASTEXITCODE -ne 0) { throw "Local FORGE history has diverged from origin/main." }
    git merge --ff-only origin/main
    if ($LASTEXITCODE -ne 0) { throw "Could not fast-forward FORGE to origin/main." }

    & (Join-Path $PSScriptRoot "package-windows.ps1")
    if ($LASTEXITCODE -ne 0) { throw "Windows packaging failed with exit code $LASTEXITCODE." }
    & (Join-Path $PSScriptRoot "install-windows.ps1")
    if ($LASTEXITCODE -ne 0) { throw "Windows installation failed with exit code $LASTEXITCODE." }

    git restore -- "apps/desktop/out/main/index.js"
    if ($LASTEXITCODE -ne 0) { throw "Could not restore the tracked generated bundle after packaging." }
    $Succeeded = $true
}
finally {
    if (-not $Succeeded) { git reset --hard $Before | Out-Null }
    if ($ObsidianStashed) {
        git stash pop --index "stash@{0}" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "The update completed, but local Obsidian state could not be restored automatically." }
    }
}

Write-Host "FORGE for Windows is updated, installed, and verified."
