$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "This uninstall procedure must run on Windows."
}

function Get-RegisteredInstallRoots {
    $Keys = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    foreach ($Key in $Keys) {
        Get-ItemProperty -Path $Key -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -eq "FORGE" -or $_.DisplayName -like "FORGE *" } |
            ForEach-Object {
                if ($_.InstallLocation) { $_.InstallLocation.Trim('"') }
                elseif ($_.DisplayIcon) {
                    $IconPath = ($_.DisplayIcon -replace ',\d+$', '').Trim('"')
                    if ($IconPath) { Split-Path -Parent $IconPath }
                }
            }
    }
}

if (Get-Process -Name "FORGE" -ErrorAction SilentlyContinue) {
    throw "Close FORGE before uninstalling it."
}

$Roots = @(
    @(Get-RegisteredInstallRoots),
    (Join-Path $env:LOCALAPPDATA "Programs\forge"),
    (Join-Path $env:LOCALAPPDATA "Programs\FORGE"),
    (Join-Path $env:ProgramFiles "FORGE")
) | Where-Object { $_ } | Select-Object -Unique
$Uninstallers = foreach ($Root in $Roots) {
    if (Test-Path -LiteralPath $Root -PathType Container) {
        Get-ChildItem -LiteralPath $Root -Filter "Uninstall*.exe" -File -ErrorAction SilentlyContinue
    }
}
$Uninstaller = $Uninstallers | Select-Object -First 1
if (-not $Uninstaller) {
    Write-Host "FORGE is not installed or its uninstaller is already gone."
    exit 0
}

$Result = Start-Process -FilePath $Uninstaller.FullName -ArgumentList "/S" -Wait -PassThru
if ($Result.ExitCode -ne 0) { throw "The FORGE uninstaller exited with code $($Result.ExitCode)." }
Write-Host "Removed FORGE using $($Uninstaller.FullName)."
