/**
 * Gera sitemap.xml a partir do índice de busca e arquivos de histórico.
 * Uso: node scripts/generate-sitemap.js
 */
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.SITE_URL ?? 'https://pesquisatabelafipe.com.br';
const BUSCA_FILE = path.join(process.cwd(), 'public', 'api', 'busca-rapida.json');
const OUT_FILE = path.join(process.cwd(), 'public', 'sitemap.xml');

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

function inferMarca(item) {
  if (item.marca) return item.marca;
  const t = item.termoBusca.toLowerCase();
  if (t.includes('toyota')) return 'Toyota';
  if (t.includes('chevrolet') || t.includes('gm ')) return 'Chevrolet';
  if (t.includes('volkswagen') || t.includes('vw ')) return 'Volkswagen';
  if (t.includes('fiat')) return 'Fiat';
  if (t.includes('honda')) return 'Honda';
  if (t.includes('hyundai')) return 'Hyundai';
  return 'geral';
}

const index = JSON.parse(fs.readFileSync(BUSCA_FILE, 'utf-8'));
const today = new Date().toISOString().split('T')[0];

const urls = [
  { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'weekly' },
  ...index.map((item) => ({
    loc: `${BASE_URL}/fipe/${marcaSlug(inferMarca(item))}/${item.id}`,
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
console.log(`Sitemap gerado: ${urls.length} URLs → ${OUT_FILE}`);
