import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'https://widokinaraj.pl';

function generateSitemapXml(): string {
  const currentDate = new Date().toISOString().slice(0, 10);

  const staticRoutes = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/wstep', priority: '0.9', changefreq: 'weekly' },
    { url: '/rhz365', priority: '0.9', changefreq: 'daily' },
    { url: '/wnr365', priority: '0.9', changefreq: 'daily' },
    { url: '/biblia365', priority: '0.9', changefreq: 'daily' },
  ];

  let urlsXml = staticRoutes.map(route => `  <url>
    <loc>${BASE_URL}${route.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n');

  // 365 Days routes for each section and main /dzien/[X]
  for (let day = 1; day <= 365; day++) {
    const dayRoutes = [
      `/dzien/${day}`,
      `/dzien/${day}/rhz365`,
      `/dzien/${day}/wnr365`,
      `/dzien/${day}/biblia365`,
      `/rhz365-day-${day}`,
      `/wnr365-day-${day}`,
      `/bible365-day-${day}`
    ];

    for (const route of dayRoutes) {
      urlsXml += `\n  <url>
    <loc>${BASE_URL}${route}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>
`;
}

async function main() {
  console.log('🌐 Generating sitemap.xml...');
  const xmlContent = generateSitemapXml();

  const publicSitemapPath = resolve(process.cwd(), 'public/sitemap.xml');
  writeFileSync(publicSitemapPath, xmlContent, 'utf-8');
  console.log(`✅ Saved sitemap to public/sitemap.xml`);

  const distDir = resolve(process.cwd(), 'dist');
  if (existsSync(distDir)) {
    const distSitemapPath = resolve(distDir, 'sitemap.xml');
    writeFileSync(distSitemapPath, xmlContent, 'utf-8');
    console.log(`✅ Saved sitemap to dist/sitemap.xml`);
  }
}

main().catch(err => {
  console.error('❌ Sitemap generation failed:', err);
  process.exit(1);
});
