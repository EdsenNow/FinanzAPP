const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crcData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
function encodePNG(w, h, rgbaPixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = w * 4;
  const rawScanlines = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    rawScanlines[y * (stride + 1)] = 0;
    rgbaPixels.copy(rawScanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idatData = zlib.deflateSync(rawScanlines, { level: 9 });
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', idatData), makeChunk('IEND', Buffer.alloc(0))]);
}
function unfilterPNG(buf) {
  let pos = 8, idat = [], w, h;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      w = buf.readUInt32BE(pos + 8); h = buf.readUInt32BE(pos + 12);
    } else if (type === 'IDAT') {
      idat.push(buf.slice(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const pixels = Buffer.alloc(w * h * bpp);
  let srcPos = 0, dstPos = 0;
  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }
  for (let y = 0; y < h; y++) {
    const filter = raw[srcPos++];
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[srcPos++];
      const a = (x >= bpp) ? pixels[dstPos - bpp] : 0;
      const b = (y > 0) ? pixels[dstPos - stride] : 0;
      const c = (x >= bpp && y > 0) ? pixels[dstPos - stride - bpp] : 0;
      let val = 0;
      if (filter === 0) val = rawByte;
      else if (filter === 1) val = (rawByte + a) & 0xff;
      else if (filter === 2) val = (rawByte + b) & 0xff;
      else if (filter === 3) val = (rawByte + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) val = (rawByte + paeth(a, b, c)) & 0xff;
      pixels[dstPos++] = val;
    }
  }
  return { w, h, pixels };
}

function resizeRGBACrop(srcPixels, srcW, srcH, cropX, cropY, cropSize, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = cropSize / dstW, yRatio = cropSize / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const srcYStart = cropY + Math.floor(dy * yRatio);
    const srcYEnd = cropY + Math.min(cropSize, Math.ceil((dy + 1) * yRatio));
    for (let dx = 0; dx < dstW; dx++) {
      const srcXStart = cropX + Math.floor(dx * xRatio);
      const srcXEnd = cropX + Math.min(cropSize, Math.ceil((dx + 1) * xRatio));

      let totalR = 0, totalG = 0, totalB = 0, totalA = 0, count = 0;
      for (let sy = srcYStart; sy < srcYEnd; sy++) {
        if (sy < 0 || sy >= srcH) continue;
        for (let sx = srcXStart; sx < srcXEnd; sx++) {
          if (sx < 0 || sx >= srcW) continue;
          const sIdx = (sy * srcW + sx) * 4;
          const a = srcPixels[sIdx + 3];
          totalR += srcPixels[sIdx] * a;
          totalG += srcPixels[sIdx + 1] * a;
          totalB += srcPixels[sIdx + 2] * a;
          totalA += a;
          count++;
        }
      }
      const dstIdx = (dy * dstW + dx) * 4;
      if (totalA === 0 || count === 0) {
        dst[dstIdx] = 0; dst[dstIdx + 1] = 0; dst[dstIdx + 2] = 0; dst[dstIdx + 3] = 0;
      } else {
        dst[dstIdx] = Math.round(totalR / totalA);
        dst[dstIdx + 1] = Math.round(totalG / totalA);
        dst[dstIdx + 2] = Math.round(totalB / totalA);
        dst[dstIdx + 3] = Math.round(totalA / count);
      }
    }
  }
  return dst;
}

function makeICO(pngList) {
  const count = pngList.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const dirEntries = [], imageBuffers = [];
  for (const item of pngList) {
    const dir = Buffer.alloc(16);
    dir[0] = item.width >= 256 ? 0 : item.width;
    dir[1] = item.height >= 256 ? 0 : item.height;
    dir[2] = 0; dir[3] = 0;
    dir.writeUInt16LE(1, 4); dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(item.buf.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirEntries.push(dir);
    imageBuffers.push(item.buf);
    offset += item.buf.length;
  }
  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

// 1. Load source image
const userUploadedDir = 'C:/Users/edsen/.gemini/antigravity-ide/brain/dfe28d2d-61a3-4b03-885b-741859a47b20/.user_uploaded';
const mediaCandidates = ['media_1788367733674.png', 'media_1788367690875.png', 'media_1788363978729.png'];
let mediaPath = null;
for (const cand of mediaCandidates) {
  const p = path.join(userUploadedDir, cand);
  if (fs.existsSync(p)) { mediaPath = p; break; }
}
const inputBuf = fs.readFileSync(mediaPath);
const { w, h, pixels } = unfilterPNG(inputBuf);

// 2. Flood fill outer corners
const isOuter = new Uint8Array(w * h);
const queue = [];
const corners = [[0, 0], [w-1, 0], [0, h-1], [w-1, h-1]];
for (const [cx, cy] of corners) {
  const cIdx = cy * w + cx;
  if (!isOuter[cIdx] && pixels[cIdx * 4 + 3] < 128) {
    isOuter[cIdx] = 1;
    queue.push(cx, cy);
  }
}
let head = 0;
while (head < queue.length) {
  const x = queue[head++];
  const y = queue[head++];
  const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
  for (const [nx, ny] of neighbors) {
    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
      const nIdx = ny * w + nx;
      if (!isOuter[nIdx] && pixels[nIdx * 4 + 3] < 128) {
        isOuter[nIdx] = 1;
        queue.push(nx, ny);
      }
    }
  }
}

// 3. Render 1024x1024 with solid white F + pink coin with white $ symbol
const processedPixels = Buffer.alloc(w * h * 4);
const PINK_R = 235, PINK_G = 111, PINK_B = 146; // #eb6f92
const coinCX = 644, coinCY = 333, coinR = 142, innerR = 118;

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const idx = y * w + x;
    const pIdx = idx * 4;
    const a = pixels[pIdx + 3];

    if (isOuter[idx]) {
      processedPixels[pIdx] = 0;
      processedPixels[pIdx + 1] = 0;
      processedPixels[pIdx + 2] = 0;
      processedPixels[pIdx + 3] = 0;
    } else {
      const d = Math.hypot(x - coinCX, y - coinCY);
      const isInsideCoin = (d <= coinR);
      const isDollar = (d <= innerR && a < 128);

      if (isInsideCoin) {
        if (d <= coinR - 2) {
          if (isDollar) {
            // Símbolo de dinero en blanco sólido con antialiasing
            const whiteRatio = (255 - a) / 255;
            const pinkRatio = a / 255;
            processedPixels[pIdx] = Math.round(255 * whiteRatio + PINK_R * pinkRatio);
            processedPixels[pIdx + 1] = Math.round(255 * whiteRatio + PINK_G * pinkRatio);
            processedPixels[pIdx + 2] = Math.round(255 * whiteRatio + PINK_B * pinkRatio);
            processedPixels[pIdx + 3] = 255;
          } else {
            // Fondo y borde de la moneda en color del icono (rosa)
            processedPixels[pIdx] = PINK_R;
            processedPixels[pIdx + 1] = PINK_G;
            processedPixels[pIdx + 2] = PINK_B;
            processedPixels[pIdx + 3] = 255;
          }
        } else {
          // Borde exterior de la moneda con antialiasing suave hacia la F blanca
          const fUnder = (a < 128);
          const edgeRatio = (coinR - d) / 2;
          if (fUnder) {
            processedPixels[pIdx] = Math.round(PINK_R * edgeRatio + 255 * (1 - edgeRatio));
            processedPixels[pIdx + 1] = Math.round(PINK_G * edgeRatio + 255 * (1 - edgeRatio));
            processedPixels[pIdx + 2] = Math.round(PINK_B * edgeRatio + 255 * (1 - edgeRatio));
          } else {
            processedPixels[pIdx] = PINK_R;
            processedPixels[pIdx + 1] = PINK_G;
            processedPixels[pIdx + 2] = PINK_B;
          }
          processedPixels[pIdx + 3] = 255;
        }
      } else {
        // Cuerpo de la 'F' en blanco sólido
        const pinkRatio = a / 255;
        const whiteRatio = 1 - pinkRatio;
        processedPixels[pIdx] = Math.round(PINK_R * pinkRatio + 255 * whiteRatio);
        processedPixels[pIdx + 1] = Math.round(PINK_G * pinkRatio + 255 * whiteRatio);
        processedPixels[pIdx + 2] = Math.round(PINK_B * pinkRatio + 255 * whiteRatio);
        processedPixels[pIdx + 3] = 255;
      }
    }
  }
}

// 4. Crop tightly to squircle boundaries for maximum tab visibility
const cropSize = 856;
const cropX = Math.round(512 - cropSize / 2);
const cropY = Math.round(493 - cropSize / 2);

// 5. Generate all sizes
const png512 = encodePNG(512, 512, resizeRGBACrop(processedPixels, 1024, 1024, cropX, cropY, cropSize, 512, 512));
const png222 = encodePNG(222, 222, resizeRGBACrop(processedPixels, 1024, 1024, cropX, cropY, cropSize, 222, 222));
const png192 = encodePNG(192, 192, resizeRGBACrop(processedPixels, 1024, 1024, cropX, cropY, cropSize, 192, 192));
const png180 = encodePNG(180, 180, resizeRGBACrop(processedPixels, 1024, 1024, cropX, cropY, cropSize, 180, 180));
const png48 = encodePNG(48, 48, resizeRGBACrop(processedPixels, 1024, 1024, cropX, cropY, cropSize, 48, 48));
const png32 = encodePNG(32, 32, resizeRGBACrop(processedPixels, 1024, 1024, cropX, cropY, cropSize, 32, 32));
const png16 = encodePNG(16, 16, resizeRGBACrop(processedPixels, 1024, 1024, cropX, cropY, cropSize, 16, 16));

// 6. Generate Multi-Resolution ICO
const icoBuf = makeICO([
  { width: 16, height: 16, buf: png16 },
  { width: 32, height: 32, buf: png32 },
  { width: 48, height: 48, buf: png48 }
]);

// 7. Generate SVG with embedded high-res image
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${png512.toString('base64')}" width="512" height="512"/>
</svg>
`;

// 8. Write all assets
fs.writeFileSync('src/assets/logo-oscuro-square.png', png222);
fs.writeFileSync('src/assets/logo-claro-square.png', png222);
fs.writeFileSync('src/assets/logo-oscuro.png', png222);
fs.writeFileSync('src/assets/logo-claro.png', png222);

fs.writeFileSync('src/Icons/android-chrome-512x512.png', png512);
fs.writeFileSync('src/Icons/android-chrome-192x192.png', png192);
fs.writeFileSync('src/Icons/apple-touch-icon.png', png180);
fs.writeFileSync('src/Icons/favicon-48x48.png', png48);
fs.writeFileSync('src/Icons/favicon-32x32.png', png32);
fs.writeFileSync('src/Icons/favicon-16x16.png', png16);
fs.writeFileSync('src/Icons/favicon.ico', icoBuf);
fs.writeFileSync('src/Icons/favicon.svg', svgContent);

console.log('All icons generated with solid clean coin badge successfully!');
