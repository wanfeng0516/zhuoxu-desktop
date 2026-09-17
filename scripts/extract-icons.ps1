param(
    [Parameter(Mandatory = $true)]
    [string]$PayloadPath
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Drawing

$source = @'
using System;
using System.Runtime.InteropServices;

public static class ZhuoXuShellIcon
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct SHFILEINFO
    {
        public IntPtr hIcon;
        public int iIcon;
        public uint dwAttributes;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szDisplayName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
        public string szTypeName;
    }

    private const uint SHGFI_ICON = 0x00000100;
    private const uint SHGFI_LARGEICON = 0x00000000;

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SHGetFileInfo(
        string pszPath,
        uint dwFileAttributes,
        out SHFILEINFO psfi,
        uint cbFileInfo,
        uint uFlags
    );

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern uint ExtractIconEx(
        string szFileName,
        int nIconIndex,
        IntPtr[] phiconLarge,
        IntPtr[] phiconSmall,
        uint nIcons
    );

    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr hIcon);

    public static IntPtr FromShell(string filePath)
    {
        SHFILEINFO info;
        IntPtr result = SHGetFileInfo(
            filePath,
            0,
            out info,
            (uint)Marshal.SizeOf(typeof(SHFILEINFO)),
            SHGFI_ICON | SHGFI_LARGEICON
        );
        return result == IntPtr.Zero ? IntPtr.Zero : info.hIcon;
    }

    public static IntPtr FromResource(string filePath, int iconIndex)
    {
        IntPtr[] large = new IntPtr[1];
        uint count = ExtractIconEx(filePath, iconIndex, large, null, 1);
        return count == 0 ? IntPtr.Zero : large[0];
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp

function Convert-IconToDataUrl([IntPtr]$Handle) {
    if ($Handle -eq [IntPtr]::Zero) { return '' }
    $clone = $null
    $bitmap = $null
    $stream = $null
    try {
        $icon = [System.Drawing.Icon]::FromHandle($Handle)
        $clone = $icon.Clone()
        $bitmap = $clone.ToBitmap()
        $stream = New-Object System.IO.MemoryStream
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        return 'data:image/png;base64,' + [Convert]::ToBase64String($stream.ToArray())
    }
    finally {
        if ($stream) { $stream.Dispose() }
        if ($bitmap) { $bitmap.Dispose() }
        if ($clone) { $clone.Dispose() }
        [ZhuoXuShellIcon]::DestroyIcon($Handle) | Out-Null
    }
}

function Resolve-ResourcePath([string]$Value) {
    if (-not $Value) { return '' }
    $expanded = [Environment]::ExpandEnvironmentVariables($Value.Trim().Trim('"'))
    return $expanded
}

try {
    $payload = [IO.File]::ReadAllText($PayloadPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
    $results = foreach ($item in @($payload)) {
        $dataUrl = ''
        $itemError = ''
        try {
            $iconPath = Resolve-ResourcePath ([string]$item.iconPath)
            if ($iconPath -and (Test-Path -LiteralPath $iconPath)) {
                $handle = [ZhuoXuShellIcon]::FromResource($iconPath, [int]$item.iconIndex)
                $dataUrl = Convert-IconToDataUrl $handle
            }
            if (-not $dataUrl) {
                $targetPath = Resolve-ResourcePath ([string]$item.targetPath)
                if ($targetPath -and (Test-Path -LiteralPath $targetPath)) {
                    $handle = [ZhuoXuShellIcon]::FromShell($targetPath)
                    $dataUrl = Convert-IconToDataUrl $handle
                }
            }
            if (-not $dataUrl) {
                $shortcutPath = Resolve-ResourcePath ([string]$item.path)
                if ($shortcutPath -and (Test-Path -LiteralPath $shortcutPath)) {
                    $handle = [ZhuoXuShellIcon]::FromShell($shortcutPath)
                    $dataUrl = Convert-IconToDataUrl $handle
                }
            }
        }
        catch {
            $dataUrl = ''
            $itemError = $_.Exception.Message
        }
        [pscustomobject]@{ id = [string]$item.id; icon = $dataUrl; error = $itemError }
    }
    @($results) | ConvertTo-Json -Compress
}
catch {
    @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
