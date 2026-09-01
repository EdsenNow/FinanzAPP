import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to decode raw RGBA from PNG
function decodePng(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 8;
  let idatBuffers = [];
  let width = 0, height = 0;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
    } else if (type === 'IDAT') {
      idatBuffers.push(buf.subarray(offset + 8, offset + 8 + len));
    }
    offset += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idatBuffers));
  const rawData = Buffer.alloc(width * height * 4);
  const stride = 1 + width * 4;

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride + 1;
    for (let x = 0; x < width; x++) {
      const srcIdx = rowStart + x * 4;
      const dstIdx = (y * width + x) * 4;
      rawData[dstIdx] = decompressed[srcIdx];       // R
      rawData[dstIdx + 1] = decompressed[srcIdx + 1]; // G
      rawData[dstIdx + 2] = decompressed[srcIdx + 2]; // B
      rawData[dstIdx + 3] = decompressed[srcIdx + 3]; // A
    }
  }
  return { width, height, rawData };
}

// Simple CRC32 for PNG writing
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}
const crcTable = makeCrcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writePng(width, height, rgbaBuffer) {
  const stride = 1 + width * 4;
  const filtered = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    filtered[y * stride] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * stride + 1 + x * 4;
      filtered[dstIdx] = rgbaBuffer[srcIdx];
      filtered[dstIdx + 1] = rgbaBuffer[srcIdx + 1];
      filtered[dstIdx + 2] = rgbaBuffer[srcIdx + 2];
      filtered[dstIdx + 3] = rgbaBuffer[srcIdx + 3];
    }
  }

  const idatData = zlib.deflateSync(filtered, { level: 9 });
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  const ihdrChunk = Buffer.alloc(4 + 4 + 13 + 4);
  ihdrChunk.writeUInt32BE(13, 0);
  ihdrChunk.write('IHDR', 4);
  ihdrData.copy(ihdrChunk, 8);
  ihdrChunk.writeUInt32BE(crc32(ihdrChunk.subarray(4, 21)), 21);

  // IDAT chunk
  const idatChunk = Buffer.alloc(4 + 4 + idatData.length + 4);
  idatChunk.writeUInt32BE(idatData.length, 0);
  idatChunk.write('IDAT', 4);
  idatData.copy(idatChunk, 8);
  idatChunk.writeUInt32BE(crc32(idatChunk.subarray(4, 8 + idatData.length)), 8 + idatData.length);

  // IEND chunk
  const iendChunk = Buffer.alloc(12);
  iendChunk.writeUInt32BE(0, 0);
  iendChunk.write('IEND', 4);
  iendChunk.writeUInt32BE(crc32(Buffer.from('IEND')), 8);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Resample with area averaging (supersampled box filter) - cleanest possible downscale
function resampleRgba(src, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const srcYStart = dy * yRatio;
    const srcYEnd = (dy + 1) * yRatio;

    for (let dx = 0; dx < dstW; dx++) {
      const srcXStart = dx * xRatio;
      const srcXEnd = (dx + 1) * xRatio;

      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, weightSum = 0;

      const y0 = Math.floor(srcYStart);
      const y1 = Math.min(Math.ceil(srcYEnd), srcH);
      const x0 = Math.floor(srcXStart);
      const x1 = Math.min(Math.ceil(srcXEnd), srcW);

      for (let sy = y0; sy < y1; sy++) {
        const yWeight = Math.min(sy + 1, srcYEnd) - Math.max(sy, srcYStart);
        if (yWeight <= 0) continue;

        for (let sx = x0; sx < x1; sx++) {
          const xWeight = Math.min(sx + 1, srcXEnd) - Math.max(sx, srcXStart);
          if (xWeight <= 0) continue;

          const weight = xWeight * yWeight;
          const srcIdx = (sy * srcW + sx) * 4;
          const a = src[srcIdx + 3] / 255;

          rSum += src[srcIdx] * a * weight;
          gSum += src[srcIdx + 1] * a * weight;
          bSum += src[srcIdx + 2] * a * weight;
          aSum += src[srcIdx + 3] * weight;
          weightSum += weight;
        }
      }

      const dstIdx = (dy * dstW + dx) * 4;
      if (weightSum > 0 && aSum > 0) {
        const finalA = aSum / weightSum;
        // Non-premultiplied color recovery
        dst[dstIdx] = Math.min(255, Math.round(rSum / (aSum / 255)));
        dst[dstIdx + 1] = Math.min(255, Math.round(gSum / (aSum / 255)));
        dst[dstIdx + 2] = Math.min(255, Math.round(bSum / (aSum / 255)));
        // Boost contrast on small sizes so thin lines don't get washed out
        dst[dstIdx + 3] = Math.min(255, Math.round(Math.pow(finalA / 255, 0.75) * 255));
      } else {
        dst[dstIdx] = 0;
        dst[dstIdx + 1] = 0;
        dst[dstIdx + 2] = 0;
        dst[dstIdx + 3] = 0;
      }
    }
  }
  return dst;
}

// Dilate strokes and square canvas to create a crisp master
function createCrispSquareMaster(srcInfo, size, radius = 2.0) {
  const { width: srcW, height: srcH, rawData: src } = srcInfo;

  // 1. First dilate the stroke in a buffer of size srcW x srcH
  const dilated = Buffer.alloc(srcW * srcH * 4);
  const radCeil = Math.ceil(radius);

  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      let maxA = 0;
      let refR = 235, refG = 111, refB = 146;

      for (let dy = -radCeil; dy <= radCeil; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= srcH) continue;
        for (let dx = -radCeil; dx <= radCeil; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= srcW) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            const idx = (ny * srcW + nx) * 4;
            const a = src[idx + 3];
            if (a > maxA) {
              maxA = a;
              refR = src[idx];
              refG = src[idx + 1];
              refB = src[idx + 2];
            }
          }
        }
      }

      const dstIdx = (y * srcW + x) * 4;
      dilated[dstIdx] = refR;
      dilated[dstIdx + 1] = refG;
      dilated[dstIdx + 2] = refB;
      dilated[dstIdx + 3] = maxA;
    }
  }

  // 2. Place centered into square canvas of size `size`
  const square = Buffer.alloc(size * size * 4);
  const targetMax = size * 0.94;
  const scale = Math.min(targetMax / srcW, targetMax / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  const offsetX = Math.floor((size - newW) / 2);
  const offsetY = Math.floor((size - newH) / 2);

  const scaled = resampleRgba(dilated, srcW, srcH, newW, newH);

  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const srcIdx = (y * newW + x) * 4;
      const dstIdx = ((y + offsetY) * size + (x + offsetX)) * 4;
      square[dstIdx] = scaled[srcIdx];
      square[dstIdx + 1] = scaled[srcIdx + 1];
      square[dstIdx + 2] = scaled[srcIdx + 2];
      square[dstIdx + 3] = scaled[srcIdx + 3];
    }
  }

  return square;
}

const darkSrcPath = path.join(rootDir, 'src', 'assets', 'logo-oscuro.png');
const darkSrcInfo = decodePng(darkSrcPath);

// Generate high-res square master (512x512) with crisp, solid strokes
const master512 = createCrispSquareMaster(darkSrcInfo, 512, 1.8);
const master512Png = writePng(512, 512, master512);

// Write crisp square assets
const iconsDir = path.join(rootDir, 'src', 'Icons');
fs.writeFileSync(path.join(rootDir, 'src', 'assets', 'logo-oscuro-square.png'), master512Png);

// Generate crisp favicons at all resolutions directly from high-res master with area supersampling
const targetSizes = [16, 32, 48, 64, 128, 180, 192, 256, 512];
const generatedBuffers = {};

for (const s of targetSizes) {
  const resampled = resampleRgba(master512, 512, 512, s, s);
  const pngBuf = writePng(s, s, resampled);
  generatedBuffers[s] = { raw: resampled, png: pngBuf };
}

fs.writeFileSync(path.join(iconsDir, 'favicon-16x16.png'), generatedBuffers[16].png);
fs.writeFileSync(path.join(iconsDir, 'favicon-32x32.png'), generatedBuffers[32].png);
fs.writeFileSync(path.join(iconsDir, 'favicon-48x48.png'), generatedBuffers[48].png);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), generatedBuffers[180].png);
fs.writeFileSync(path.join(iconsDir, 'android-chrome-192x192.png'), generatedBuffers[192].png);
fs.writeFileSync(path.join(iconsDir, 'android-chrome-512x512.png'), generatedBuffers[512].png);

// Build true multi-frame ICO (16, 32, 48, 64, 128, 256)
const icoSizes = [16, 32, 48, 64, 128, 256];
const numImages = icoSizes.length;
const headerSize = 6;
const dirEntrySize = 16;
let currentOffset = headerSize + (dirEntrySize * numImages);

const headerBuf = Buffer.alloc(headerSize);
headerBuf.writeUInt16LE(0, 0); // reserved
headerBuf.writeUInt16LE(1, 2); // type 1 = ICO
headerBuf.writeUInt16LE(numImages, 4); // count

const dirEntries = [];
const imageBuffers = [];

for (const s of icoSizes) {
  const png = generatedBuffers[s].png;
  const entry = Buffer.alloc(dirEntrySize);
  entry.writeUInt8(s >= 256 ? 0 : s, 0); // width
  entry.writeUInt8(s >= 256 ? 0 : s, 1); // height
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8); // size in bytes
  entry.writeUInt32LE(currentOffset, 12); // offset

  dirEntries.push(entry);
  imageBuffers.push(png);
  currentOffset += png.length;
}

const finalIcoBuffer = Buffer.concat([headerBuf, ...dirEntries, ...imageBuffers]);
fs.writeFileSync(path.join(iconsDir, 'favicon.ico'), finalIcoBuffer);

// Also generate SVG favicon with high-res base64 master
const masterBase64 = master512Png.toString('base64');
const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${masterBase64}" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), svgFavicon);

console.log('Crisp, bold, anti-aliased favicons generated successfully!');
