param(
    [string]$ReleaseDirectory = (Join-Path $PSScriptRoot '..\release')
)

$ErrorActionPreference = 'Stop'

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseRoot = [IO.Path]::GetFullPath($ReleaseDirectory)
$expectedReleaseRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'release'))
if (-not $releaseRoot.Equals($expectedReleaseRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Release directory must be $expectedReleaseRoot"
}

$package = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$version = [string]$package.version
if ($version -notmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') {
    throw "package.json contains an invalid version: $version"
}

$installerName = "ZhuoXu-Setup-$version-x64.exe"
$archiveName = "ZhuoXu-Setup-$version-x64.zip"
$installerPath = Join-Path $releaseRoot $installerName
$archivePath = Join-Path $releaseRoot $archiveName
$checksumPath = Join-Path $releaseRoot 'SHA256SUMS.txt'

if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
    throw "Installer was not found: $installerPath"
}

$currentArtifactNames = @(
    $installerName
    $archiveName
    "$installerName.blockmap"
)
Get-ChildItem -LiteralPath $releaseRoot -File | Where-Object {
    $_.Name -like 'ZhuoXu-Setup-*-x64.exe' -or
    $_.Name -like 'ZhuoXu-Setup-*-x64.exe.blockmap' -or
    $_.Name -like 'ZhuoXu-Setup-*-x64.zip'
} | Where-Object {
    $_.Name -notin $currentArtifactNames
} | Remove-Item -Force

Compress-Archive -LiteralPath $installerPath -DestinationPath $archivePath -CompressionLevel Optimal -Force

$artifacts = @($installerPath, $archivePath)
$checksumLines = foreach ($artifact in $artifacts) {
    $hash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([IO.Path]::GetFileName($artifact))"
}
[IO.File]::WriteAllLines($checksumPath, $checksumLines, [Text.UTF8Encoding]::new($false))

$artifacts + $checksumPath | ForEach-Object {
    $item = Get-Item -LiteralPath $_
    [pscustomobject]@{
        Name = $item.Name
        Bytes = $item.Length
        SHA256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
} | Format-Table -AutoSize
