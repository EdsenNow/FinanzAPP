#!/usr/bin/env node
/**
 * FinanzApp build script
 * ----------------------
 * Procesa src/ y genera el directorio public/ listo para Hosting.
 *   1. Limpia public/ (conservando .firebase/).
 *   2. Copia todo el contenido estático de src/ a public/.
 *   3. Genera public/__config.js desde variables de entorno (.env).
 *   4. Extrae <script> inline de cada HTML a archivos externos (CSP).
 *   5. Añade atributos integrity (SRI) a recursos CDN descargables.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'public');

dotenv.config({ path: path.join(ROOT, '.env') });

const CDN_INTEGRITY_CACHE = new Map();

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function sha384Base64(data) {
  return crypto.createHash('sha384').update(data).digest('base64');
}

function shortHash(data, len = 12) {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, len);
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function cleanOut() {
  if (!(await exists(OUT))) return;
  const entries = await fs.readdir(OUT, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.firebase') continue;
    const p = path.join(OUT, entry.name);
    await fs.rm(p, { recursive: true, force: true });
  }
}

function buildConfigJs() {
  const firebase = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
  };
  const app = {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    gmailClientId: process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    gmailBackendUrl: process.env.GMAIL_BACKEND_URL || '',
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || '',
    appCheckEnabled: process.env.APPCHECK_ENABLED === 'true'
  };
  return `window.FIREBASE_CONFIG=${JSON.stringify(firebase)};\nwindow.APP_CONFIG=${JSON.stringify(app)};\n`;
}

function shouldSkipCdn(url) {
  // Google Fonts sirve CSS diferente según el user-agent; un hash calculado
  // durante el build raramente coincide con el del navegador.
  // Google Identity Services, jsDelivr y gstatic no deben usar SRI dinámico inconsistente.
  return /^https:\/\/fonts\.googleapis\.com\//i.test(url) ||
         /^https:\/\/accounts\.google\.com\/gsi\/client/i.test(url) ||
         /^https:\/\/cdn\.jsdelivr\.net\//i.test(url) ||
         /^https:\/\/www\.gstatic\.com\//i.test(url);
}

async function fetchIntegrity(url) {
  if (shouldSkipCdn(url)) return null;
  if (CDN_INTEGRITY_CACHE.has(url)) return CDN_INTEGRITY_CACHE.get(url);
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = sha384Base64(buf);
    const integrity = `sha384-${hash}`;
    CDN_INTEGRITY_CACHE.set(url, integrity);
    return integrity;
  } catch (err) {
    console.warn(`  ⚠️  No se pudo calcular SRI para ${url}: ${err.message}`);
    CDN_INTEGRITY_CACHE.set(url, null);
    return null;
  }
}

function setAttr(tag, name, value) {
  const re = new RegExp(`\\b${name}=("[^"]*"|'[^']*')`, 'i');
  if (re.test(tag)) {
    return tag.replace(re, `${name}="${value}"`);
  }
  // Insert before the closing >
  return tag.replace(/\s*(\/?>)$/, ` ${name}="${value}"$1`);
}

function removeAttr(tag, name) {
  const re = new RegExp(`\\s+${name}=("[^"]*"|'[^']*')`, 'gi');
  return tag.replace(re, '');
}

function hasAttr(tag, name) {
  return new RegExp(`\\b${name}\\s*=`, 'i').test(tag);
}

async function processHtml(filePath) {
  let html = await fs.readFile(filePath, 'utf8');
  const relativeDir = path.dirname(path.relative(OUT, filePath));

  // 1) Extraer scripts inline
  const inlineScriptRe = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  const inlineMatches = [...html.matchAll(inlineScriptRe)];
  let inlineIndex = 0;
  for (const m of inlineMatches) {
    const attrs = m[1] || '';
    const content = m[2];
    if (!content.trim()) continue;
    if (/\ssrc\s*=/i.test(attrs)) continue; // ya es externo
    if (/\stype\s*=\s*["']module["']/i.test(attrs)) continue; // no soportado

    const hash = shortHash(content);
    const fileName = relativeDir === '.'
      ? `inline-${hash}.js`
      : `${relativeDir.replace(/\\/g, '/')}/inline-${hash}.js`;
    const outPath = path.join(OUT, fileName);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, content.trim() + `\n//# sourceURL=/${fileName}\n`);

    const newTag = `<script src="/${fileName}"></script>`;
    html = html.replace(m[0], newTag);
    inlineIndex++;
  }

  // 2) Añadir SRI a scripts CDN
  html = await replaceAsync(html, /<script\s+([^>]*?)src\s*=\s*["'](https?:\/\/[^"']+)["']([^>]*)>/gi, async (match, pre, url, post) => {
    let tag = match;
    if (shouldSkipCdn(url)) return tag;
    if (!hasAttr(tag, 'crossorigin')) {
      tag = setAttr(tag, 'crossorigin', 'anonymous');
    }
    if (!hasAttr(tag, 'integrity')) {
      const integrity = await fetchIntegrity(url);
      if (integrity) tag = setAttr(tag, 'integrity', integrity);
    }
    return tag;
  });

  // 3) Añadir SRI a hojas de estilo CDN
  html = await replaceAsync(html, /<link\s+([^>]*?)href\s*=\s*["'](https?:\/\/[^"']+)["']([^>]*)>/gi, async (match, pre, url, post) => {
    if (!/\srel\s*=\s*["']stylesheet["']/i.test(match)) return match;
    if (shouldSkipCdn(url)) return match;
    let tag = match;
    if (!hasAttr(tag, 'crossorigin')) {
      tag = setAttr(tag, 'crossorigin', 'anonymous');
    }
    if (!hasAttr(tag, 'integrity')) {
      const integrity = await fetchIntegrity(url);
      if (integrity) tag = setAttr(tag, 'integrity', integrity);
    }
    return tag;
  });

  // 4) Cache buster para scripts locales
  const buildVersion = Date.now();
  html = html.replace(/<script\s+([^>]*?)src\s*=\s*["']([^"']+\.js)(?:\?[^"']*)?["']([^>]*)>/gi, (match, pre, src, post) => {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
      return match;
    }
    return `<script ${pre}src="${src}?v=${buildVersion}"${post}>`;
  });

  // 5) Inject global cache buster and SW unregister to nuke old stale Service Workers
  const cacheBusterScript = `
    <script>
      (function() {
        if ('caches' in window) {
          caches.keys().then(function(names) {
            for (var i = 0; i < names.length; i++) {
              caches.delete(names[i]);
            }
          });
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for (var i = 0; i < registrations.length; i++) {
              registrations[i].unregister();
            }
          });
        }
      })();
      //# sourceURL=/sw-cleanup.js
    </script>
  </body>`;
  html = html.replace(/<\/body>/i, cacheBusterScript);

  await fs.writeFile(filePath, html);
  if (inlineIndex > 0) {
    console.log(`  📄 ${path.relative(ROOT, filePath)} — ${inlineIndex} script(s) inline extraído(s)`);
  }
}

async function replaceAsync(str, re, asyncFn) {
  const promises = [];
  str.replace(re, (match, ...args) => {
    const promise = asyncFn(match, ...args);
    promises.push(promise);
    return match;
  });
  const replacements = await Promise.all(promises);
  let i = 0;
  return str.replace(re, () => replacements[i++]);
}

async function build() {
  console.log('🔧 Iniciando build de FinanzApp...');

  await cleanOut();
  console.log('🧹 public/ limpiado');

  await copyDir(SRC, OUT);
  console.log('📁 src/ copiado a public/');

  const configContent = buildConfigJs();
  await fs.writeFile(path.join(OUT, '__config.js'), configContent);
  await fs.writeFile(path.join(SRC, '__config.js'), configContent);
  await fs.writeFile(path.join(ROOT, '__config.js'), configContent);
  console.log('⚙️  __config.js generado en public/, src/ y raíz');

  // Procesar todos los HTML
  const htmlFiles = [];
  async function collectHtml(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) await collectHtml(p);
      else if (entry.name.endsWith('.html')) htmlFiles.push(p);
    }
  }
  await collectHtml(OUT);
  console.log(`🌐 Procesando ${htmlFiles.length} archivo(s) HTML...`);
  await Promise.all(htmlFiles.map(processHtml));

  console.log('✅ Build completado en public/');
}

build().catch(err => {
  console.error('❌ Build fallido:', err);
  process.exit(1);
});
