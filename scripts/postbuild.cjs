const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
const dist404 = path.join(__dirname, '..', 'dist', '404.html');
const distRedirects = path.join(__dirname, '..', 'dist', '_redirects');
const publicRedirects = path.join(__dirname, '..', 'public', '_redirects');

if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, dist404);
  console.log('[Postbuild] Successfully copied dist/index.html to dist/404.html for SPA fallback!');
} else {
  console.error('[Postbuild] Error: dist/index.html does not exist!');
  process.exit(1);
}

if (fs.existsSync(publicRedirects)) {
  fs.copyFileSync(publicRedirects, distRedirects);
  console.log('[Postbuild] Successfully copied public/_redirects to dist/_redirects!');
}
