#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(process.cwd(), 'node_modules', 'google-gax', 'package.json');

try {
  if (!fs.existsSync(pkgPath)) {
    console.log('[patch-google-gax] node_modules/google-gax not found, skipping patch');
    process.exit(0);
  }
  const raw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  pkg.exports = pkg.exports || {};
  const additions = {
    './build/src/fallback': './build/src/fallback.js',
    './build/src/status': './build/src/status.js',
    './build/src/gax': './build/src/gax.js'
  };
  let changed = false;
  for (const [k, v] of Object.entries(additions)) {
    if (!pkg.exports[k]) {
      pkg.exports[k] = v;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('[patch-google-gax] patched', pkgPath);
  } else {
    console.log('[patch-google-gax] nothing to change');
  }
} catch (e) {
  console.error('[patch-google-gax] error:', e);
  process.exit(1);
}
