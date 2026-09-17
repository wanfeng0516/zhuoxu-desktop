$ErrorActionPreference = 'Stop'

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseRoot = Join-Path $projectRoot 'release'
$package = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$version = [string]$package.version
$installerName = "ZhuoXu-Setup-$version-x64.exe"
$archiveName = "ZhuoXu-Setup-$version-x64.zip"
$installerPath = Join-Path $releaseRoot $installerName
$archivePath = Join-Path $releaseRoot $archiveName
$checksumPath = Join-Path $releaseRoot 'SHA256SUMS.txt'
$productName = ([string][char]0x684C) + ([char]0x5E8F)

foreach ($requiredPath in @($installerPath, $archivePath, $checksumPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Missing release file: $requiredPath"
    }
}

$expectedHashes = @{}
foreach ($line in Get-Content -Encoding UTF8 $checksumPath) {
    if ($line -match '^([0-9a-fA-F]{64})\s{2}(.+)$') {
        $expectedHashes[$Matches[2]] = $Matches[1].ToLowerInvariant()
    }
}
foreach ($artifactPath in @($installerPath, $archivePath)) {
    $artifactName = [IO.Path]::GetFileName($artifactPath)
    $actualHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expectedHashes[$artifactName] -ne $actualHash) {
        throw "SHA-256 mismatch for $artifactName"
    }
}

$existingInstall = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -eq $productName }
if ($existingInstall) {
    throw "$productName is already installed for the current user. Uninstall it before running release validation."
}

$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) "$productName.lnk"
$startMenuShortcut = Join-Path ([Environment]::GetFolderPath('StartMenu')) "Programs\$productName.lnk"
if ((Test-Path -LiteralPath $desktopShortcut) -or (Test-Path -LiteralPath $startMenuShortcut)) {
    throw "A $productName shortcut already exists. Remove it before running release validation."
}

$validationRoot = Join-Path $env:TEMP ("zhuoxu-release-validation-" + [guid]::NewGuid().ToString('N'))
$extractRoot = Join-Path $validationRoot 'archive'
$installRoot = Join-Path $validationRoot 'installed'
$uninstallerPath = Join-Path $installRoot 'Uninstall ZhuoXu.exe'
$installedAppPath = Join-Path $installRoot 'ZhuoXu.exe'
$installed = $false

try {
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot -Force
    $extractedInstaller = Join-Path $extractRoot $installerName
    if (-not (Test-Path -LiteralPath $extractedInstaller -PathType Leaf)) {
        throw "The ZIP does not contain $installerName"
    }

    $sourceHash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash
    $extractedHash = (Get-FileHash -LiteralPath $extractedInstaller -Algorithm SHA256).Hash
    if ($sourceHash -ne $extractedHash) { throw 'The installer changed after ZIP extraction.' }

    $installProcess = Start-Process -FilePath $extractedInstaller -ArgumentList @('/S', "/D=$installRoot") -Wait -PassThru -WindowStyle Hidden
    if ($installProcess.ExitCode -ne 0) { throw "Installer exited with code $($installProcess.ExitCode)" }
    $installed = $true

    foreach ($installedPath in @($installedAppPath, $uninstallerPath, $desktopShortcut, $startMenuShortcut)) {
        if (-not (Test-Path -LiteralPath $installedPath)) { throw "Installation did not create: $installedPath" }
    }

    $installedVersion = (Get-Item -LiteralPath $installedAppPath).VersionInfo.ProductVersion
    $normalizedInstalledVersion = ([version]$installedVersion).ToString(3)
    if ($normalizedInstalledVersion -ne $version) {
        throw "Installed version $installedVersion does not match package version $version"
    }

    $uninstallEntry = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -eq $productName -and $_.DisplayVersion -eq $version } |
        Select-Object -First 1
    if (-not $uninstallEntry) { throw 'The expected uninstall registry entry was not created.' }

    [pscustomobject]@{
        Version = $version
        Archive = $archiveName
        InstallerSHA256 = $sourceHash.ToLowerInvariant()
        InstalledExecutable = [IO.Path]::GetFileName($installedAppPath)
        DesktopShortcut = $true
        StartMenuShortcut = $true
        UninstallEntry = $true
    } | Format-List
}
finally {
    if ($installed -and (Test-Path -LiteralPath $uninstallerPath)) {
        $uninstallProcess = Start-Process -FilePath $uninstallerPath -ArgumentList '/S' -Wait -PassThru -WindowStyle Hidden
        if ($uninstallProcess.ExitCode -ne 0) {
            Write-Warning "Uninstaller exited with code $($uninstallProcess.ExitCode)"
        }
        Start-Sleep -Seconds 2
    }

    if (Test-Path -LiteralPath $desktopShortcut) { [IO.File]::Delete($desktopShortcut) }
    if (Test-Path -LiteralPath $startMenuShortcut) { [IO.File]::Delete($startMenuShortcut) }
    if (Test-Path -LiteralPath $validationRoot) { [IO.Directory]::Delete($validationRoot, $true) }
}

$remainingEntry = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -eq $productName }
if ($remainingEntry) { throw 'Release validation left an uninstall registry entry behind.' }

Write-Host 'Release validation and cleanup completed successfully.'
