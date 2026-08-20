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

// Inject Vite built assets into Service Worker's precache list
const distSw = path.join(__dirname, '..', 'dist', 'sw.js');
const assetsDir = path.join(__dirname, '..', 'dist', 'assets');

if (fs.existsSync(distSw) && fs.existsSync(assetsDir)) {
  try {
    const assetFiles = fs.readdirSync(assetsDir);
    const assetUrls = assetFiles.map(file => `/assets/${file}`);
    
    console.log(`[Postbuild] Scanning dist/assets... Found ${assetFiles.length} files to cache:`);
    assetUrls.forEach(url => console.log(` - ${url}`));

    let swContent = fs.readFileSync(distSw, 'utf-8');
    if (swContent.includes('const PRECACHE_ASSETS = [')) {
      const injection = `const PRECACHE_ASSETS = [\n  ${assetUrls.map(u => `'${u}'`).join(',\n  ')},`;
      swContent = swContent.replace('const PRECACHE_ASSETS = [', injection);
      fs.writeFileSync(distSw, swContent, 'utf-8');
      console.log('[Postbuild] Successfully injected Vite built assets into dist/sw.js!');
    } else {
      console.warn('[Postbuild] Could not find PRECACHE_ASSETS in sw.js');
    }
  } catch (err) {
    console.error('[Postbuild] Error injecting assets into service worker:', err);
  }
}

