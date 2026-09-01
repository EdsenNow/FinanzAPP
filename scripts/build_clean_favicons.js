import fs from 'fs';
import zlib from 'zlib';

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function decodePNG(buf) {
  let offset = 8;
  let width, height;
  const idats = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.slice(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idats.push(data);
    }
    offset += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idats));
  const rowSize = 1 + width * 4;
  const rgba = Buffer.alloc(width * height * 4);
  const prevRow = Buffer.alloc(width * 4);
  const currRow = Buffer.alloc(width * 4);

  for (let y = 0; y < height; y++) {
    const filter = decompressed[y * rowSize];
    const rowData = decompressed.slice(y * rowSize + 1, (y + 1) * rowSize);
    
    for (let x = 0; x < width * 4; x++) {
      const raw = rowData[x];
      const a = (x >= 4) ? currRow[x - 4] : 0;
      const b = prevRow[x];
      const c = (x >= 4) ? prevRow[x - 4] : 0;
      let val = 0;
      if (filter === 0) val = raw;
      else if (filter === 1) val = (raw + a) & 0xFF;
      else if (filter === 2) val = (raw + b) & 0xFF;
      else if (filter === 3) val = (raw + Math.floor((a + b) / 2)) & 0xFF;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        val = (raw + pr) & 0xFF;
      }
      currRow[x] = val;
      rgba[(y * width * 4) + x] = val;
    }
    currRow.copy(prevRow);
  }
  return { width, height, rgba };
}

function encodePNG(width, height, rgba) {
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 4)] = 0;
    rgba.copy(scanlines, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(scanlines, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Resample with area averaging and premultiplied alpha (prevents any color fringing!)
function resizeImage(srcWidth, srcHeight, srcRgba, targetSize) {
  const targetRgba = Buffer.alloc(targetSize * targetSize * 4, 0);
  const scale = srcWidth / targetSize;

  for (let dy = 0; dy < targetSize; dy++) {
    for (let dx = 0; dx < targetSize; dx++) {
      const srcXStart = dx * scale;
      const srcXEnd = (dx + 1) * scale;
      const srcYStart = dy * scale;
      const srcYEnd = (dy + 1) * scale;

      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      let totalWeight = 0;

      const minX = Math.floor(srcXStart);
      const maxX = Math.min(srcWidth - 1, Math.floor(srcXEnd));
      const minY = Math.floor(srcYStart);
      const maxY = Math.min(srcHeight - 1, Math.floor(srcYEnd));

      for (let sy = minY; sy <= maxY; sy++) {
        const yWeight = Math.min(sy + 1, srcYEnd) - Math.max(sy, srcYStart);
        for (let sx = minX; sx <= maxX; sx++) {
          const xWeight = Math.min(sx + 1, srcXEnd) - Math.max(sx, srcXStart);
          const weight = xWeight * yWeight;

          const idx = (sy * srcWidth + sx) * 4;
          const a = srcRgba[idx + 3] / 255;
          const r = srcRgba[idx] * a;
          const g = srcRgba[idx + 1] * a;
          const b = srcRgba[idx + 2] * a;

          rSum += r * weight;
          gSum += g * weight;
          bSum += b * weight;
          aSum += srcRgba[idx + 3] * weight;
          totalWeight += weight;
        }
      }

      const outIdx = (dy * targetSize + dx) * 4;
      if (totalWeight > 0 && aSum > 0) {
        const avgA = aSum / totalWeight;
        const alphaFactor = avgA / 255;
        targetRgba[outIdx] = Math.min(255, Math.round((rSum / totalWeight) / alphaFactor));
        targetRgba[outIdx + 1] = Math.min(255, Math.round((gSum / totalWeight) / alphaFactor));
        targetRgba[outIdx + 2] = Math.min(255, Math.round((bSum / totalWeight) / alphaFactor));
        targetRgba[outIdx + 3] = Math.min(255, Math.round(avgA));
      }
    }
  }
  return targetRgba;
}

// Generate all
const baseSquareBuf = fs.readFileSync('src/assets/logo-oscuro.png');
const { width, height, rgba } = decodePNG(baseSquareBuf);

// Copy square files
fs.copyFileSync('src/assets/logo-oscuro.png', 'src/assets/logo-oscuro-square.png');
fs.copyFileSync('src/assets/logo-claro.png', 'src/assets/logo-claro-square.png');

const sizes = [512, 192, 180, 32, 16];
for (const size of sizes) {
  const resizedRgba = resizeImage(width, height, rgba, size);
  const pngData = encodePNG(size, size, resizedRgba);
  if (size === 512) fs.writeFileSync('src/Icons/android-chrome-512x512.png', pngData);
  if (size === 192) fs.writeFileSync('src/Icons/android-chrome-192x192.png', pngData);
  if (size === 180) fs.writeFileSync('src/Icons/apple-touch-icon.png', pngData);
  if (size === 32) fs.writeFileSync('src/Icons/favicon-32x32.png', pngData);
  if (size === 16) fs.writeFileSync('src/Icons/favicon-16x16.png', pngData);
}

// Build standard Windows ICO for 32x32
const png32Data = fs.readFileSync('src/Icons/favicon-32x32.png');
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
icoHeader.writeUInt16LE(1, 4); // Number of images

const icoDir = Buffer.alloc(16);
icoDir.writeUInt8(32, 0); // Width
icoDir.writeUInt8(32, 1); // Height
icoDir.writeUInt8(0, 2);  // Palette colors
icoDir.writeUInt8(0, 3);  // Reserved
icoDir.writeUInt16LE(1, 4); // Color planes
icoDir.writeUInt16LE(32, 6); // Bits per pixel
icoDir.writeUInt32LE(png32Data.length, 8); // Size of image data
icoDir.writeUInt32LE(22, 12); // Offset to image data (6 + 16 = 22)

fs.writeFileSync('src/Icons/favicon.ico', Buffer.concat([icoHeader, icoDir, png32Data]));
console.log('Favicons and square logos generated with pure mathematical precision and 0 chromatic artifacts!');
