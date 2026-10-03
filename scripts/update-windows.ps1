$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "This update procedure must run on Windows."
}

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $RepositoryRoot

foreach ($RequiredFile in @("scripts\package-windows.ps1", "scripts\install-windows.ps1")) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot $RequiredFile) -PathType Leaf)) {
        throw "Required Windows update procedure is missing: $RequiredFile"
    }
}

& npm run package:windows
if ($LASTEXITCODE -ne 0) { throw "Windows packaging failed with exit code $LASTEXITCODE." }
& npm run install:windows
if ($LASTEXITCODE -ne 0) { throw "Windows installation failed with exit code $LASTEXITCODE." }

Write-Host "FORGE for Windows was rebuilt and installed from the current checkout."
