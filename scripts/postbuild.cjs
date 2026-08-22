const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
const dist404 = path.join(__dirname, '..', 'dist', '404.html');
const distRedirects = path.join(__dirname, '..', 'dist', '_redirects');
const publicRedirects = path.join(__dirname, '..', 'public', '_redirects');

// 1. SPA fallback: copy index.html → 404.html for Cloudflare Pages routing
if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, dist404);
  console.log('[Postbuild] Copied dist/index.html → dist/404.html for SPA fallback');
} else {
  console.error('[Postbuild] ERROR: dist/index.html does not exist!');
  process.exit(1);
}

// 2. Copy _redirects and _headers for Cloudflare Pages SPA routing & cache control
if (fs.existsSync(publicRedirects)) {
  fs.copyFileSync(publicRedirects, distRedirects);
  console.log('[Postbuild] Copied public/_redirects → dist/_redirects');
}
const publicHeaders = path.join(__dirname, '..', 'public', '_headers');
const distHeaders = path.join(__dirname, '..', 'dist', '_headers');
if (fs.existsSync(publicHeaders)) {
  fs.copyFileSync(publicHeaders, distHeaders);
  console.log('[Postbuild] Copied public/_headers → dist/_headers');
}

// Note: SW asset injection intentionally REMOVED.
// sw.js v19 uses network-only for /assets/ — injecting chunk names into PRECACHE_ASSETS
// would cause stale chunk serving on redeployments (the root cause of the cache error screen).
console.log('[Postbuild] Done.');
