const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');
const distIndex = path.join(distDir, 'index.html');
const dist404 = path.join(distDir, '404.html');

// 1. SPA fallback: copy index.html → 404.html for Cloudflare Pages routing
if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, dist404);
  console.log('[Postbuild] Copied dist/index.html → dist/404.html for SPA fallback');
} else {
  console.error('[Postbuild] ERROR: dist/index.html does not exist!');
  process.exit(1);
}

// 2. Generate Sitemap XML
try {
  console.log('[Postbuild] Running sitemap generator...');
  execSync('npx tsx scripts/generateSitemap.ts', { stdio: 'inherit' });
} catch (e) {
  console.warn('[Postbuild] Warning: Could not run generateSitemap.ts inline:', e.message);
}

// 3. Copy routing, headers, robots, sitemap to dist
const filesToCopy = ['_redirects', '_headers', '_routes.json', 'robots.txt', 'sitemap.xml'];

filesToCopy.forEach((filename) => {
  const src = path.join(publicDir, filename);
  const dest = path.join(distDir, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[Postbuild] Copied public/${filename} → dist/${filename}`);
  }
});

// 4. Copy export-md directory to dist if present
const exportMdPublic = path.join(publicDir, 'export-md');
const exportMdDist = path.join(distDir, 'export-md');
if (fs.existsSync(exportMdPublic)) {
  fs.cpSync(exportMdPublic, exportMdDist, { recursive: true });
  console.log('[Postbuild] Copied public/export-md → dist/export-md');
}

// 5. Invalidate Service Worker cache on every build
const distSw = path.join(distDir, 'sw.js');
if (fs.existsSync(distSw)) {
  let swContent = fs.readFileSync(distSw, 'utf-8');
  swContent = swContent.replace(/embik365-v\d+-[a-z0-9-]+/g, `embik365-build-${Date.now()}`);
  fs.writeFileSync(distSw, swContent);
  console.log('[Postbuild] Injected unique cache key into dist/sw.js');
}

console.log('[Postbuild] Done.');
