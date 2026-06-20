/**
 * Gera sitemap index + sitemaps parciais (veÃ­culos, SEO).
 */
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.SITE_URL ?? 'https://pesquisatabelafipe.com.br';
const PUBLIC = path.join(process.cwd(), 'public');
const OUT_INDEX = path.join(PUBLIC, 'sitemap.xml');
const MANIFEST = path.join(PUBLIC, 'data', 'fipe', 'search', 'manifest.json');
const SEARCH_DIR = path.join(PUBLIC, 'data', 'fipe', 'search');
const SEO_MARCAS = path.join(PUBLIC, 'data', 'seo', 'marcas.json');
const SEO_ANOS = path.join(PUBLIC, 'data', 'seo', 'anos.json');
const SEO_COMPARATIVOS = path.join(PUBLIC, 'data', 'seo', 'comparativos.json');
const SEO_MANIFEST = path.join(PUBLIC, 'data', 'seo', 'manifest.json');
const SEM_INTENTS = path.join(PUBLIC, 'data', 'semantic', 'intents-index.json');


const today = new Date().toISOString().split('T')[0];

function urlEntry(loc, priority, changefreq) {
  return { loc, priority, changefreq };
}

function writeUrlset(file, urls) {
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
  fs.writeFileSync(file, xml, 'utf-8');
  return urls.length;
}

function writeSitemapIndex(files) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files
  .map(
    (f) => `  <sitemap>
    <loc>${BASE_URL}/${f.name}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;
  fs.writeFileSync(OUT_INDEX, xml, 'utf-8');
}

function loadVehicleIndex() {
  if (!fs.existsSync(MANIFEST)) return [];
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  const items = [];
  for (const s of manifest.shards ?? []) {
    const p = path.join(SEARCH_DIR, `shard-${s}.json`);
    if (fs.existsSync(p)) items.push(...JSON.parse(fs.readFileSync(p, 'utf-8')));
  }
  return items;
}

const vehicleItems = loadVehicleIndex();
const vehicleUrls = vehicleItems.map((item) =>
  urlEntry(`${BASE_URL}/fipe/${item.m}/${item.i}`, '0.8', 'monthly'),
);

const staticUrls = [
  urlEntry(`${BASE_URL}/`, '1.0', 'weekly'),
  urlEntry(`${BASE_URL}/busca`, '0.7', 'weekly'),
  urlEntry(`${BASE_URL}/comparar`, '0.75', 'weekly'),
];

const seoUrls = [...staticUrls];

if (fs.existsSync(SEO_MARCAS)) {
  const { marcas } = JSON.parse(fs.readFileSync(SEO_MARCAS, 'utf-8'));
  for (const m of marcas ?? []) {
    seoUrls.push(urlEntry(`${BASE_URL}/marca/${m.slug}`, '0.85', 'weekly'));
  }
}

if (fs.existsSync(SEO_MANIFEST)) {
  const manifest = JSON.parse(fs.readFileSync(SEO_MANIFEST, 'utf-8'));
  const modelPaths = manifest.paths?.modelos ?? manifest.modelosPaths ?? [];
  for (const rel of modelPaths) {
    const fileName = path.basename(rel, '.json');
    const dash = fileName.indexOf('-');
    if (dash <= 0) continue;
    const marcaSlugPart = fileName.slice(0, dash);
    const modeloSlugPart = fileName.slice(dash + 1);
    seoUrls.push(urlEntry(`${BASE_URL}/modelo/${marcaSlugPart}/${modeloSlugPart}`, '0.82', 'weekly'));
    seoUrls.push(urlEntry(`${BASE_URL}/historico/${marcaSlugPart}/${modeloSlugPart}`, '0.8', 'monthly'));
  }
}

if (fs.existsSync(SEO_ANOS)) {
  const { anos } = JSON.parse(fs.readFileSync(SEO_ANOS, 'utf-8'));
  for (const a of anos ?? []) {
    seoUrls.push(urlEntry(`${BASE_URL}/ano/${a.ano}`, '0.78', 'monthly'));
  }
}

if (fs.existsSync(SEO_COMPARATIVOS)) {
  const { pares } = JSON.parse(fs.readFileSync(SEO_COMPARATIVOS, 'utf-8'));
  for (const p of pares ?? []) {
    seoUrls.push(urlEntry(`${BASE_URL}/comparar/${p.slug}`, '0.8', 'weekly'));
  }
}

const counts = {};

let semanticCount = 0;
if (fs.existsSync(SEM_INTENTS)) {
  const intents = JSON.parse(fs.readFileSync(SEM_INTENTS, 'utf-8'));
  const topSemantic = intents
    .slice()
    .sort((a, b) => (b[8] || 0) - (a[8] || 0))
    .slice(0, 10000)
    .map((row) => urlEntry(`${BASE_URL}${row[4]}`, '0.72', 'monthly'));
  semanticCount = writeUrlset(path.join(PUBLIC, 'sitemap-semantic.xml'), topSemantic);
}
counts.semantic = semanticCount;

counts.static = writeUrlset(path.join(PUBLIC, 'sitemap-static.xml'), seoUrls);
counts.vehicles = writeUrlset(path.join(PUBLIC, 'sitemap-vehicles.xml'), vehicleUrls);

const indexFiles = [{ name: 'sitemap-static.xml' }, { name: 'sitemap-vehicles.xml' }];
if (semanticCount > 0) indexFiles.push({ name: 'sitemap-semantic.xml' });
writeSitemapIndex(indexFiles);

const total = counts.static + counts.vehicles + (counts.semantic ?? 0);
console.log(
  JSON.stringify(
    {
      sitemapIndex: OUT_INDEX,
      total,
      static: counts.static,
      vehicles: counts.vehicles,
      semantic: counts.semantic ?? 0,
    },
    null,
    2,
  ),
);

