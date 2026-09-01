Add-Type -AssemblyName System.Drawing

function MakeSquareIcon($sourcePath, $destPath, $size) {
    $srcImg = [System.Drawing.Image]::FromFile($sourcePath)
    $srcW = $srcImg.Width
    $srcH = $srcImg.Height

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $targetMax = $size * 0.95
    $scale = [Math]::Min($targetMax / $srcW, $targetMax / $srcH)
    $newW = [int]($srcW * $scale)
    $newH = [int]($srcH * $scale)
    $x = [int](($size - $newW) / 2)
    $y = [int](($size - $newH) / 2)

    $g.DrawImage($srcImg, $x, $y, $newW, $newH)

    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $srcImg.Dispose()
}

$root = (Get-Location).Path

# Generate squared favicons for dark theme
MakeSquareIcon "$root\src\assets\logo-oscuro.png" "$root\src\Icons\android-chrome-512x512.png" 512
MakeSquareIcon "$root\src\assets\logo-oscuro.png" "$root\src\Icons\android-chrome-192x192.png" 192
MakeSquareIcon "$root\src\assets\logo-oscuro.png" "$root\src\Icons\apple-touch-icon.png" 180
MakeSquareIcon "$root\src\assets\logo-oscuro.png" "$root\src\Icons\favicon-32x32.png" 32
MakeSquareIcon "$root\src\assets\logo-oscuro.png" "$root\src\Icons\favicon-16x16.png" 16
MakeSquareIcon "$root\src\assets\logo-oscuro.png" "$root\src\assets\logo-oscuro-square.png" 512
MakeSquareIcon "$root\src\assets\logo-claro.png" "$root\src\assets\logo-claro-square.png" 512

# Also generate favicon.ico using 32x32
$png32 = "$root\src\Icons\favicon-32x32.png"
$icoPath = "$root\src\Icons\favicon.ico"
$iconImg = [System.Drawing.Bitmap]::FromFile($png32)
$hIcon = $iconImg.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$iconImg.Dispose()

Write-Host "All icons squared successfully without stretching!"
