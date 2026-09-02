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

// -------------------------------------------------------------
// 1. CARGA DE IMÁGENES FUENTE
// -------------------------------------------------------------
// Modo Claro usa #B4637A (imagen malva/rosa suave)
// Modo Oscuro usa #EB6F92 (imagen rosa vibrante)
const CLARO_SRC = 'C:/Users/edsen/.gemini/antigravity-ide/brain/dfe28d2d-61a3-4b03-885b-741859a47b20/.user_uploaded/media_1788369196507.png';
const OSCURO_SRC = 'C:/Users/edsen/.gemini/antigravity-ide/brain/dfe28d2d-61a3-4b03-885b-741859a47b20/.user_uploaded/media_1788369196560.png';

const claroData = unfilterPNG(fs.readFileSync(CLARO_SRC));
const oscuroData = unfilterPNG(fs.readFileSync(OSCURO_SRC));

const w = 1024, h = 1024;

// -------------------------------------------------------------
// 2. DETECCIÓN DE ESQUINAS EXTERIORES TRANSPARENTES (SQUIRCLE)
// -------------------------------------------------------------
function getOuterMask(pixels) {
  const isOuter = new Uint8Array(w * h);
  const queue = [0, 0, w-1, 0, 0, h-1, w-1, h-1];
  for (let i = 0; i < queue.length; i += 2) isOuter[queue[i+1] * w + queue[i]] = 1;
  let head = 0;
  while (head < queue.length) {
    const x = queue[head++]; const y = queue[head++];
    for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nIdx = ny * w + nx;
        if (!isOuter[nIdx] && pixels[nIdx * 4 + 3] < 128) {
          isOuter[nIdx] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }
  return isOuter;
}

const isOuter = getOuterMask(oscuroData.pixels);

// -------------------------------------------------------------
// 3. GENERAR LOGOS DE APLICACIÓN CON INTERIOR BLANCO SÓLIDO
// -------------------------------------------------------------
// Modo Claro = #B4637A
const CLARO_R = 180, CLARO_G = 99, CLARO_B = 122; // #B4637A
// Modo Oscuro = #EB6F92
const OSCURO_R = 235, OSCURO_G = 111, OSCURO_B = 146; // #EB6F92

function buildAppLogo(srcPixels, bgR, bgG, bgB) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pIdx = idx * 4;
      const a = srcPixels[pIdx + 3];

      if (isOuter[idx]) {
        out[pIdx] = bgR;
        out[pIdx + 1] = bgG;
        out[pIdx + 2] = bgB;
        out[pIdx + 3] = a;
      } else {
        const bgRatio = a / 255;
        const whiteRatio = 1 - bgRatio;
        out[pIdx] = Math.round(bgR * bgRatio + 255 * whiteRatio);
        out[pIdx + 1] = Math.round(bgG * bgRatio + 255 * whiteRatio);
        out[pIdx + 2] = Math.round(bgB * bgRatio + 255 * whiteRatio);
        out[pIdx + 3] = 255;
      }
    }
  }
  return out;
}

const appLogoClaro1024 = buildAppLogo(claroData.pixels, CLARO_R, CLARO_G, CLARO_B);
const appLogoOscuro1024 = buildAppLogo(oscuroData.pixels, OSCURO_R, OSCURO_G, OSCURO_B);

// -------------------------------------------------------------
// 4. CONSTRUCCIÓN DE LA F CENTRADA PARA EL NAVEGADOR (SIN MONEDA)
// -------------------------------------------------------------
const fMask = new Float32Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (y < 265 || y > 810 || x < 270 || x > 640) continue;
    if (x > 388 && y >= 385 && y < 469) continue;
    if (x > 450 && y < 450) continue;

    const idx = (y * w + x) * 4;
    const a = oscuroData.pixels[idx + 3];
    const whiteAmount = 1 - (a / 255);
    fMask[y * w + x] = Math.max(0, Math.min(1, whiteAmount));
  }
}

// Brazo central redondeado limpio
for (let y = 465; y <= 590; y++) {
  for (let x = 450; x <= 635; x++) {
    let distToCap = 0;
    if (x <= 574) {
      if (y >= 470 && y <= 586) distToCap = -10;
      else if (y < 470) distToCap = 470 - y;
      else distToCap = y - 586;
    } else {
      const d = Math.hypot(x - 574, y - 528);
      distToCap = d - 58;
    }
    fMask[y * w + x] = Math.max(0, Math.min(1, 0.5 - distToCap));
  }
}

// Brazo superior reconstruido con idéntica curvatura y grosor (116px), sin moneda
for (let y = 260; y <= 385; y++) {
  for (let x = 388; x <= 635; x++) {
    let distToCap = 0;
    if (x <= 574) {
      if (y >= 266 && y <= 382) distToCap = -10;
      else if (y < 266) distToCap = 266 - y;
      else distToCap = y - 382;
    } else {
      const d = Math.hypot(x - 574, y - 324);
      distToCap = d - 58;
    }
    fMask[y * w + x] = Math.max(0, Math.min(1, 0.5 - distToCap));
  }
}

// Centrar la F en (512, 493)
let fMinX = w, fMaxX = 0, fMinY = h, fMaxY = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (fMask[y * w + x] > 0.5) {
      if (x < fMinX) fMinX = x;
      if (x > fMaxX) fMaxX = x;
      if (y < fMinY) fMinY = y;
      if (y > fMaxY) fMaxY = y;
    }
  }
}
const fCenterX = (fMinX + fMaxX) / 2;
const fCenterY = (fMinY + fMaxY) / 2;
const shiftX = Math.round(512 - fCenterX);
const shiftY = Math.round(493 - fCenterY);

function buildCenteredFavicon(bgR, bgG, bgB) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pIdx = idx * 4;
      const a = oscuroData.pixels[pIdx + 3];

      if (isOuter[idx]) {
        out[pIdx] = bgR; out[pIdx+1] = bgG; out[pIdx+2] = bgB; out[pIdx+3] = a;
      } else {
        const srcX = x - shiftX;
        const srcY = y - shiftY;
        let whiteAmt = 0;
        if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
          whiteAmt = fMask[srcY * w + srcX];
        }
        out[pIdx] = Math.round(bgR * (1 - whiteAmt) + 255 * whiteAmt);
        out[pIdx + 1] = Math.round(bgG * (1 - whiteAmt) + 255 * whiteAmt);
        out[pIdx + 2] = Math.round(bgB * (1 - whiteAmt) + 255 * whiteAmt);
        out[pIdx + 3] = 255;
      }
    }
  }
  return out;
}

const faviconClaro1024 = buildCenteredFavicon(CLARO_R, CLARO_G, CLARO_B);   // #B4637A
const faviconOscuro1024 = buildCenteredFavicon(OSCURO_R, OSCURO_G, OSCURO_B); // #EB6F92

// -------------------------------------------------------------
// 5. CROP ÓPTIMO Y EXPORTACIÓN EN TODOS LOS FORMATOS
// -------------------------------------------------------------
const cropSize = 856;
const cropX = Math.round(512 - cropSize / 2); // 84
const cropY = Math.round(493 - cropSize / 2); // 65

// a) Logos de la Aplicación (con F y moneda interior blanco)
// Modo Claro = #B4637A
const logoClaroPng = encodePNG(222, 222, resizeRGBACrop(appLogoClaro1024, w, h, cropX, cropY, cropSize, 222, 222));
// Modo Oscuro = #EB6F92
const logoOscuroPng = encodePNG(222, 222, resizeRGBACrop(appLogoOscuro1024, w, h, cropX, cropY, cropSize, 222, 222));

fs.writeFileSync('src/assets/logo-claro-square.png', logoClaroPng);
fs.writeFileSync('src/assets/logo-claro.png', logoClaroPng);
fs.writeFileSync('src/assets/logo-oscuro-square.png', logoOscuroPng);
fs.writeFileSync('src/assets/logo-oscuro.png', logoOscuroPng);

// b) Favicons para Navegador (Solo la F, centrada, interior blanco puro)
// La app es primordialmente de modo oscuro (#191724), por lo que los estáticos usan el tono oscuro #EB6F92
const fav512Oscuro = encodePNG(512, 512, resizeRGBACrop(faviconOscuro1024, w, h, cropX, cropY, cropSize, 512, 512));
const fav192Oscuro = encodePNG(192, 192, resizeRGBACrop(faviconOscuro1024, w, h, cropX, cropY, cropSize, 192, 192));
const fav180Oscuro = encodePNG(180, 180, resizeRGBACrop(faviconOscuro1024, w, h, cropX, cropY, cropSize, 180, 180));
const fav48Oscuro = encodePNG(48, 48, resizeRGBACrop(faviconOscuro1024, w, h, cropX, cropY, cropSize, 48, 48));
const fav32Oscuro = encodePNG(32, 32, resizeRGBACrop(faviconOscuro1024, w, h, cropX, cropY, cropSize, 32, 32));
const fav16Oscuro = encodePNG(16, 16, resizeRGBACrop(faviconOscuro1024, w, h, cropX, cropY, cropSize, 16, 16));

// Versión clara de 512 para el SVG dinámico
const fav512Claro = encodePNG(512, 512, resizeRGBACrop(faviconClaro1024, w, h, cropX, cropY, cropSize, 512, 512));

// Favicon Multi-Resolución ICO
const icoBuf = makeICO([
  { width: 16, height: 16, buf: fav16Oscuro },
  { width: 32, height: 32, buf: fav32Oscuro },
  { width: 48, height: 48, buf: fav48Oscuro }
]);

fs.writeFileSync('src/Icons/favicon.ico', icoBuf);
fs.writeFileSync('src/Icons/favicon-16x16.png', fav16Oscuro);
fs.writeFileSync('src/Icons/favicon-32x32.png', fav32Oscuro);
fs.writeFileSync('src/Icons/favicon-48x48.png', fav48Oscuro);
fs.writeFileSync('src/Icons/apple-touch-icon.png', fav180Oscuro);
fs.writeFileSync('src/Icons/android-chrome-192x192.png', fav192Oscuro);
fs.writeFileSync('src/Icons/android-chrome-512x512.png', fav512Oscuro);

// Favicon SVG dinámico con soporte exacto de temas:
// - Modo Claro: #B4637A
// - Modo Oscuro (default): #EB6F92
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <style>
    :root { color-scheme: light dark; }
    .dark-theme { display: block; }
    .light-theme { display: none; }
    @media (prefers-color-scheme: light) {
      .dark-theme { display: none; }
      .light-theme { display: block; }
    }
  </style>
  <image class="dark-theme" href="data:image/png;base64,${fav512Oscuro.toString('base64')}" width="512" height="512"/>
  <image class="light-theme" href="data:image/png;base64,${fav512Claro.toString('base64')}" width="512" height="512"/>
</svg>
`;
fs.writeFileSync('src/Icons/favicon.svg', svgContent);

console.log('✅ Todos los iconos y favicons fueron generados con éxito con la paleta corregida: Claro (#B4637A) y Oscuro (#EB6F92)!');
