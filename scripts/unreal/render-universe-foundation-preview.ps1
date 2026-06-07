$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")
$outputDirectory = Join-Path $repoRoot "docs\unreal\screenshots"
$outputPath = Join-Path $outputDirectory "universe-foundation.png"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$width = 1280
$height = 720
$bitmap = [System.Drawing.Bitmap]::new($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  [System.Drawing.Rectangle]::new(0, 0, $width, $height),
  [System.Drawing.Color]::FromArgb(255, 3, 6, 16),
  [System.Drawing.Color]::FromArgb(255, 1, 2, 7),
  35
)
$graphics.FillRectangle($background, 0, 0, $width, $height)

$random = [System.Random]::new(210501)
for ($i = 0; $i -lt 520; $i++) {
  $x = $random.NextDouble() * $width
  $y = $random.NextDouble() * $height
  $size = 0.6 + ($random.NextDouble() * 2.2)
  $alpha = 70 + [int]($random.NextDouble() * 170)
  $starBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, 185, 225, 255))
  $graphics.FillEllipse($starBrush, [float]$x, [float]$y, [float]$size, [float]$size)
  $starBrush.Dispose()
}

$centerX = $width / 2
$centerY = $height / 2
$radius = 238

$gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(55, 70, 170, 230), 1.5)
$graphics.DrawEllipse($gridPen, $centerX - $radius, $centerY - $radius, $radius * 2, $radius * 2)
$graphics.DrawEllipse($gridPen, $centerX - 44, $centerY - 44, 88, 88)

$domains = @(
  @{ Name = "Space"; Angle = 0; Color = [System.Drawing.Color]::FromArgb(255, 52, 122, 255) },
  @{ Name = "Time"; Angle = 60; Color = [System.Drawing.Color]::FromArgb(255, 34, 216, 236) },
  @{ Name = "Mind"; Angle = 120; Color = [System.Drawing.Color]::FromArgb(255, 168, 92, 255) },
  @{ Name = "Soul"; Angle = 180; Color = [System.Drawing.Color]::FromArgb(255, 255, 92, 170) },
  @{ Name = "Reality"; Angle = 240; Color = [System.Drawing.Color]::FromArgb(255, 78, 235, 114) },
  @{ Name = "Power"; Angle = 300; Color = [System.Drawing.Color]::FromArgb(255, 255, 166, 56) }
)

$font = [System.Drawing.Font]::new("Segoe UI", 18, [System.Drawing.FontStyle]::Regular)
$smallFont = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Regular)
$titleFont = [System.Drawing.Font]::new("Segoe UI", 24, [System.Drawing.FontStyle]::Regular)
$labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235, 205, 232, 255))
$mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(150, 128, 170, 210))

foreach ($domain in $domains) {
  $angle = [Math]::PI * [double]$domain.Angle / 180.0
  $x = $centerX + ([Math]::Cos($angle) * $radius)
  $y = $centerY + ([Math]::Sin($angle) * $radius * 0.72)

  $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(65, $domain.Color.R, $domain.Color.G, $domain.Color.B), 1.2)
  $graphics.DrawLine($linePen, [float]$centerX, [float]$centerY, [float]$x, [float]$y)
  $linePen.Dispose()

  $glowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(48, $domain.Color.R, $domain.Color.G, $domain.Color.B))
  $coreBrush = [System.Drawing.SolidBrush]::new($domain.Color)
  $graphics.FillEllipse($glowBrush, [float]($x - 26), [float]($y - 26), 52, 52)
  $graphics.FillEllipse($coreBrush, [float]($x - 9), [float]($y - 9), 18, 18)
  $graphics.DrawString($domain.Name, $font, $labelBrush, [float]($x - 34), [float]($y + 22))
  $glowBrush.Dispose()
  $coreBrush.Dispose()
}

$gateBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(230, 112, 214, 255))
$gateGlow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(35, 112, 214, 255))
$graphics.FillEllipse($gateGlow, $centerX - 52, $centerY - 52, 104, 104)
$graphics.FillEllipse($gateBrush, $centerX - 7, $centerY - 7, 14, 14)
$graphics.DrawString("Human Gate Reserve", $smallFont, $labelBrush, $centerX - 66, $centerY + 16)

$graphics.DrawString("JARVIS Gauntlet Universe_01", $titleFont, $labelBrush, 38, 30)
$graphics.DrawString("Dark cosmic command-space foundation - read-only visual client", $smallFont, $mutedBrush, 42, 68)
$graphics.DrawString("Preview generated from documented anchor layout; capture an in-editor screenshot from GAUNTLET_Overview_Camera for final art review.", $smallFont, $mutedBrush, 42, 674)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()
$background.Dispose()
$gridPen.Dispose()
$font.Dispose()
$smallFont.Dispose()
$titleFont.Dispose()
$labelBrush.Dispose()
$mutedBrush.Dispose()
$gateBrush.Dispose()
$gateGlow.Dispose()

Write-Host $outputPath
