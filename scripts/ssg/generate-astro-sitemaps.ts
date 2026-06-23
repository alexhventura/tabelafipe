import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllCanonicalUrls } from '../../astro-ssg/src/lib/paths.server.ts';

const SITE_URL = 'https://pesquisatabelafipe.com.br';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'astro-ssg', 'dist');

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function writeSitemap(filename: string, urls: string[]): number {
  if (!urls.length) return 0;
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escXml(`${SITE_URL}${u}`)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, filename), xml, 'utf-8');
  return urls.length;
}

function main() {
  const groups = getAllCanonicalUrls();
  const counts = {
    vehicles: writeSitemap('sitemap-vehicles.xml', groups.vehicles),
    families: writeSitemap('sitemap-families.xml', groups.families),
    generations: writeSitemap('sitemap-generations.xml', groups.generations),
    engines: writeSitemap('sitemap-engines.xml', groups.engines),
    platforms: writeSitemap('sitemap-platforms.xml', groups.platforms),
  };

  const sitemaps = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([name]) => `sitemap-${name}.xml`);

  const indexBody = sitemaps
    .map(
      (f) =>
        `  <sitemap>\n    <loc>${escXml(`${SITE_URL}/${f}`)}</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n  </sitemap>`,
    )
    .join('\n');

  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexBody}\n</sitemapindex>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap-index.xml'), indexXml, 'utf-8');

  const report = {
    geradoEm: new Date().toISOString(),
    dist: DIST,
    sitemaps: counts,
    totalUrls: Object.values(counts).reduce((a, b) => a + b, 0),
  };

  const reportPath = path.join(ROOT, 'data', 'reports', 'astro-sitemap-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report));
}

main();
