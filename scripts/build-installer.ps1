param(
    [ValidateSet('nsis', 'portable')]
    [string]$Target = 'nsis'
)

$ErrorActionPreference = 'Stop'

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$builder = Join-Path $projectRoot 'node_modules\.bin\electron-builder.cmd'
if (-not (Test-Path -LiteralPath $builder -PathType Leaf)) {
    throw 'electron-builder is not installed. Run npm ci first.'
}

$env:ELECTRON_BUILDER_CACHE = Join-Path $projectRoot '.electron-builder-cache'

Push-Location $projectRoot
try {
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw "Static checks failed with exit code $LASTEXITCODE" }

    $buildSucceeded = $false
    for ($attempt = 1; $attempt -le 3; $attempt += 1) {
        & $builder --win $Target --x64
        if ($LASTEXITCODE -eq 0) {
            $buildSucceeded = $true
            break
        }
        if ($attempt -lt 3) {
            Write-Warning "electron-builder failed on attempt $attempt. Retrying with the local cache..."
            Start-Sleep -Seconds 3
        }
    }
    if (-not $buildSucceeded) { throw 'electron-builder failed after 3 attempts.' }
}
finally {
    Pop-Location
}
