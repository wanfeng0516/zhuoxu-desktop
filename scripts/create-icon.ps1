param([string]$OutputPath)

Add-Type -AssemblyName System.Drawing
$size = 512
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(246, 247, 244))

$shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 31, 34))
$teal = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 138, 120))
$blue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 118, 200))
$coral = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(219, 108, 76))
$gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(213, 154, 49))
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255))

function Draw-RoundRect($g, $brush, $x, $y, $w, $h, $r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $r, $r, 180, 90)
    $path.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
    $path.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90)
    $path.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)
    $path.Dispose()
}

Draw-RoundRect $graphics $shadow 88 94 336 324 56
Draw-RoundRect $graphics $white 74 78 336 324 56
$tiles = @(
    @{ x = 112; y = 120; brush = $teal },
    @{ x = 224; y = 120; brush = $blue },
    @{ x = 112; y = 232; brush = $gold },
    @{ x = 224; y = 232; brush = $teal }
)
foreach ($tile in $tiles) { Draw-RoundRect $graphics $tile.brush $tile.x $tile.y 78 78 20 }
Draw-RoundRect $graphics $coral 330 188 78 78 20
$arrowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(219, 108, 76), 14)
$arrowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$arrowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($arrowPen, 330, 288, 287, 288)
$graphics.DrawLine($arrowPen, 288, 288, 309, 267)
$graphics.DrawLine($arrowPen, 288, 288, 309, 309)

$directory = Split-Path -Parent $OutputPath
if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$arrowPen.Dispose()
$shadow.Dispose(); $teal.Dispose(); $blue.Dispose(); $coral.Dispose(); $gold.Dispose(); $white.Dispose()
$graphics.Dispose(); $bitmap.Dispose()
