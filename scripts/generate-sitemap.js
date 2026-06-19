/**
 * Gera sitemap.xml a partir do indice sharded ou busca-rapida.
 */
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.SITE_URL ?? 'https://pesquisatabelafipe.com.br';
const OUT_FILE = path.join(process.cwd(), 'public', 'sitemap.xml');
const MANIFEST = path.join(process.cwd(), 'public', 'data', 'fipe', 'search', 'manifest.json');
const LEGACY_MANIFEST = path.join(process.cwd(), 'public', 'api', 'fipe', 'search', 'manifest.json');
const SEARCH_DIR = path.join(process.cwd(), 'public', 'data', 'fipe', 'search');
const LEGACY_SEARCH_DIR = path.join(process.cwd(), 'public', 'api', 'fipe', 'search');
const BUSCA_FILE = path.join(process.cwd(), 'public', 'api', 'busca-rapida.json');

function marcaSlug(marca) {
  const lower = (marca || '').toLowerCase();
  if (lower.includes('chevrolet') || lower.includes('gm')) return 'chevrolet';
  if (lower.includes('volkswagen') || lower.includes('vw')) return 'volkswagen';
  return lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadIndex() {
  for (const [manifestPath, searchDir] of [
    [MANIFEST, SEARCH_DIR],
    [LEGACY_MANIFEST, LEGACY_SEARCH_DIR],
  ]) {
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (manifest.total > 0 && manifest.shards?.length) {
      const items = [];
      for (const s of manifest.shards) {
        const p = path.join(searchDir, `shard-${s}.json`);
        if (fs.existsSync(p)) items.push(...JSON.parse(fs.readFileSync(p, 'utf-8')));
      }
      return items.map((i) => ({ id: i.i, marca: i.m, nome: i.n }));
    }
  }
  if (fs.existsSync(BUSCA_FILE)) {
    return JSON.parse(fs.readFileSync(BUSCA_FILE, 'utf-8'));
  }
  return [];
}

const index = loadIndex();
const today = new Date().toISOString().split('T')[0];

const urls = [
  { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'weekly' },
  ...index.map((item) => ({
    loc: `${BASE_URL}/fipe/${marcaSlug(item.marca || item.m)}/${item.id}`,
    priority: '0.8',
    changefreq: 'monthly',
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

fs.writeFileSync(OUT_FILE, xml, 'utf-8');
console.log(`Sitemap gerado: ${urls.length} URLs -> ${OUT_FILE}`);
