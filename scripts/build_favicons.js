import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Generate crisp square PNGs for all standard sizes using PowerShell high quality bicubic scaling
const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512];
const darkSrc = path.join(rootDir, 'src', 'assets', 'logo-oscuro.png');
const lightSrc = path.join(rootDir, 'src', 'assets', 'logo-claro.png');
const iconsDir = path.join(rootDir, 'src', 'Icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate square images with padding
const psScript = `
Add-Type -AssemblyName System.Drawing

function RenderSquarePng($src, $dest, $size) {
    $img = [System.Drawing.Image]::FromFile($src)
    $srcW = $img.Width
    $srcH = $img.Height

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Fit in square keeping aspect ratio
    $targetMax = $size * 0.96
    $scale = [Math]::Min($targetMax / $srcW, $targetMax / $srcH)
    $newW = [int]($srcW * $scale)
    $newH = [int]($srcH * $scale)
    $x = [int](($size - $newW) / 2)
    $y = [int](($size - $newH) / 2)

    $g.DrawImage($img, $x, $y, $newW, $newH)
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

${sizes.map(s => `RenderSquarePng '${darkSrc.replace(/\\/g, '/')}' '${path.join(iconsDir, `icon-${s}.png`).replace(/\\/g, '/')}' ${s}`).join('\n')}
RenderSquarePng '${darkSrc.replace(/\\/g, '/')}' '${path.join(iconsDir, 'favicon-16x16.png').replace(/\\/g, '/')}' 16
RenderSquarePng '${darkSrc.replace(/\\/g, '/')}' '${path.join(iconsDir, 'favicon-32x32.png').replace(/\\/g, '/')}' 32
RenderSquarePng '${darkSrc.replace(/\\/g, '/')}' '${path.join(iconsDir, 'favicon-48x48.png').replace(/\\/g, '/')}' 48
RenderSquarePng '${darkSrc.replace(/\\/g, '/')}' '${path.join(iconsDir, 'apple-touch-icon.png').replace(/\\/g, '/')}' 180
RenderSquarePng '${darkSrc.replace(/\\/g, '/')}' '${path.join(iconsDir, 'android-chrome-192x192.png').replace(/\\/g, '/')}' 192
RenderSquarePng '${darkSrc.replace(/\\/g, '/')}' '${path.join(iconsDir, 'android-chrome-512x512.png').replace(/\\/g, '/')}' 512
RenderSquarePng '${darkSrc.replace(/\\/g, '/')}' '${path.join(rootDir, 'src', 'assets', 'logo-oscuro-square.png').replace(/\\/g, '/')}' 512
RenderSquarePng '${lightSrc.replace(/\\/g, '/')}' '${path.join(rootDir, 'src', 'assets', 'logo-claro-square.png').replace(/\\/g, '/')}' 512
`;

fs.writeFileSync(path.join(rootDir, 'scripts', 'temp_render.ps1'), psScript);
execSync(`powershell -ExecutionPolicy Bypass -File "${path.join(rootDir, 'scripts', 'temp_render.ps1')}"`);
fs.unlinkSync(path.join(rootDir, 'scripts', 'temp_render.ps1'));

// 2. Build modern true 32-bit Multi-frame ICO (16, 32, 48, 64, 128, 256)
const icoSizes = [16, 32, 48, 64, 128, 256];
const icoFrames = icoSizes.map(s => ({
  size: s,
  buffer: fs.readFileSync(path.join(iconsDir, `icon-${s}.png`))
}));

// Build ICO header + directory
const headerSize = 6;
const dirEntrySize = 16;
const numImages = icoFrames.length;
let currentOffset = headerSize + (dirEntrySize * numImages);

const headerBuf = Buffer.alloc(headerSize);
headerBuf.writeUInt16LE(0, 0); // reserved
headerBuf.writeUInt16LE(1, 2); // type 1 = ICO
headerBuf.writeUInt16LE(numImages, 4); // count

const dirEntries = [];
const imageBuffers = [];

for (const frame of icoFrames) {
  const entry = Buffer.alloc(dirEntrySize);
  entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 0); // width
  entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 1); // height
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(frame.buffer.length, 8); // size in bytes
  entry.writeUInt32LE(currentOffset, 12); // offset

  dirEntries.push(entry);
  imageBuffers.push(frame.buffer);
  currentOffset += frame.buffer.length;
}

const finalIcoBuffer = Buffer.concat([headerBuf, ...dirEntries, ...imageBuffers]);
fs.writeFileSync(path.join(iconsDir, 'favicon.ico'), finalIcoBuffer);

// Clean up temporary individual icon-*.png
for (const s of sizes) {
  const tmpFile = path.join(iconsDir, `icon-${s}.png`);
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
}

// 3. Create crisp SVG favicon with embedded base64 square logo
const squareDarkBase64 = fs.readFileSync(path.join(rootDir, 'src', 'assets', 'logo-oscuro-square.png')).toString('base64');
const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${squareDarkBase64}" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), svgFavicon);

console.log('Favicons built successfully with true multi-resolution 32-bit ICO and SVG support!');
