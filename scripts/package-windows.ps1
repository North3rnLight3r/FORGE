$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "This packaging procedure must run on Windows."
}

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $RepositoryRoot

foreach ($Command in @("node", "npm")) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Required command is unavailable: $Command"
    }
}

foreach ($RequiredFile in @(
    "package.json",
    "package-lock.json",
    "scripts\prepare-node-pty.mjs",
    "scripts\stage-runtime-metadata.mjs",
    "scripts\write-build-manifest.mjs",
    "scripts\verify-build-manifest.mjs"
)) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $RequiredFile) -PathType Leaf)) {
        throw "Required project file is missing: $RequiredFile"
    }
}

function Invoke-NpmChecked {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & npm @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

Invoke-NpmChecked ci
Invoke-NpmChecked run typecheck
Invoke-NpmChecked run lint
Invoke-NpmChecked test
Invoke-NpmChecked run clean
Invoke-NpmChecked run build
Invoke-NpmChecked run stage:win-runtime-metadata
& npx electron-builder --win --x64 --publish never
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed with exit code $LASTEXITCODE." }
& node scripts/write-build-manifest.mjs x64 win32
if ($LASTEXITCODE -ne 0) { throw "Writing the Windows build manifest failed with exit code $LASTEXITCODE." }

& node scripts/verify-build-manifest.mjs
if ($LASTEXITCODE -ne 0) {
    throw "Windows build manifest verification failed with exit code $LASTEXITCODE."
}

$Version = node -p "require('./package.json').version"
$OutputDirectory = Join-Path $RepositoryRoot "dist_electron"
$BuildManifest = Get-Content -LiteralPath (Join-Path $OutputDirectory "build-manifest.json") -Raw | ConvertFrom-Json
$InstallerArtifact = $BuildManifest.artifacts | Where-Object { $_.kind -eq "nsis" } | Select-Object -First 1
if (-not $InstallerArtifact) { throw "The verified Windows build manifest does not contain an NSIS installer." }
$InstallerPath = Join-Path $RepositoryRoot $InstallerArtifact.path

$PtyRoot = Join-Path $OutputDirectory "win-unpacked\resources\app.asar.unpacked\node_modules\node-pty"
$RequiredPtyResources = @("pty.node", "conpty.node", "conpty_console_list.node")
foreach ($Resource in $RequiredPtyResources) {
    if (-not (Get-ChildItem -LiteralPath $PtyRoot -Recurse -File -Filter $Resource -ErrorAction SilentlyContinue | Select-Object -First 1)) {
        throw "The Windows package is missing the required node-pty resource: $Resource"
    }
}

Write-Host "Windows packaging succeeded for FORGE ${Version}:"
Write-Host "  $InstallerPath"
Write-Host "  Verified NSIS installer, blockmap, runtime provenance, and build manifest"
Write-Host "  Verified Windows node-pty resources in $PtyRoot"
