/**
 * Gera sitemap index + sitemaps parciais otimizados para indexação Google.
 *
 * - lastmod por URL a partir dos bundles/dados reais (sem Date() genérico)
 * - Apenas URLs públicas com bundle/dado correspondente (crawl budget)
 * - Veículos fatiados (40k) ordenados por recência + ano + valor
 * - Sem priority/changefreq (ignorados pelo Google)
 * - Imagem OG padrão nos veículos (Google Imagens)
 */
import fs from 'fs';
import path from 'path';
import {
  VEHICLE_SITEMAP_CHUNK,
  SEMANTIC_LIMIT,
  absoluteUrl,
  buildSitemapIndexXml,
  buildUrlsetXml,
  chunkArray,
  dedupeUrls,
  fileMtimeW3c,
  maxLastmod,
  mirrorToDist,
  readBundleMeta,
  toW3cDate,
  writeSitemapFile,
} from './lib/sitemap-core.js';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');
const BASE_URL = process.env.SITE_URL ?? 'https://pesquisatabelafipe.com.br';
const OG_IMAGE = absoluteUrl(BASE_URL, '/og-default.svg');

const PATHS = {
  vehicleUrlMap: path.join(PUBLIC, 'data', 'vehicle-url-map.json'),
  seoMarcas: path.join(PUBLIC, 'data', 'seo', 'marcas.json'),
  seoAnos: path.join(PUBLIC, 'data', 'seo', 'anos.json'),
  seoComparativos: path.join(PUBLIC, 'data', 'seo', 'comparativos.json'),
  seoManifest: path.join(PUBLIC, 'data', 'seo', 'manifest.json'),
  semanticIntents: path.join(PUBLIC, 'data', 'semantic', 'intents-index.json'),
  searchManifest: path.join(PUBLIC, 'data', 'fipe', 'search', 'manifest.json'),
};

const INFO_SLUGS = ['sobre', 'metodologia', 'fontes-dados', 'privacidade', 'cookies', 'termos'];

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function loadMarcasList() {
  const raw = readJson(PATHS.seoMarcas, []);
  const rows = Array.isArray(raw) ? raw : (raw.marcas ?? []);
  const bySlug = new Map();
  for (const marca of rows) {
    if (!marca?.slug || !marca.modelos?.length) continue;
    const existing = bySlug.get(marca.slug);
    if (!existing || (marca.tipo === 'carros' && existing.tipo !== 'carros')) {
      bySlug.set(marca.slug, marca);
    }
  }
  return [...bySlug.values()];
}

/** @returns {import('./lib/sitemap-core.js').SitemapUrl[]} */
function buildVehicleUrls() {
  const urlMap = readJson(PATHS.vehicleUrlMap, {});
  const cache = new Map();
  const entries = [];

  let processed = 0;
  for (const entry of Object.values(urlMap)) {
    const canonicalPath = entry?.canonicalPath;
    const bundlePath = entry?.bundlePath;
    if (!canonicalPath || !bundlePath) continue;

    const meta = readBundleMeta(PUBLIC, bundlePath, cache);
    if (!meta?.lastmod) continue;

    entries.push({
      loc: absoluteUrl(BASE_URL, canonicalPath),
      lastmod: meta.lastmod,
      image: OG_IMAGE,
      _sort: {
        lastmod: meta.lastmod,
        ano: meta.ano,
        valor: meta.valor,
      },
    });

    processed += 1;
    if (processed % 5000 === 0) {
      console.error(`sitemap: ${processed} veículos processados…`);
    }
  }

  entries.sort((a, b) => {
    const sa = a._sort;
    const sb = b._sort;
    if (sb.lastmod !== sa.lastmod) return sb.lastmod.localeCompare(sa.lastmod);
    if (sb.ano !== sa.ano) return sb.ano - sa.ano;
    return sb.valor - sa.valor;
  });

  return entries.map(({ loc, lastmod, image }) => ({ loc, lastmod, image }));
}

/** @returns {import('./lib/sitemap-core.js').SitemapUrl[]} */
function buildStaticUrls(seoManifest) {
  /** @type {import('./lib/sitemap-core.js').SitemapUrl[]} */
  const urls = [];
  const fallbackLastmod =
    toW3cDate(seoManifest?.geradoEm) ??
    fileMtimeW3c(PATHS.seoManifest) ??
    fileMtimeW3c(PATHS.seoMarcas);

  urls.push({
    loc: absoluteUrl(BASE_URL, '/'),
    lastmod: fallbackLastmod,
  });

  for (const slug of INFO_SLUGS) {
    const infoHtml =
      [path.join(DIST, slug, 'index.html'), path.join(PUBLIC, slug, 'index.html')]
        .find((p) => fs.existsSync(p)) ?? null;
    urls.push({
      loc: absoluteUrl(BASE_URL, `/${slug}/`),
      lastmod: (infoHtml && fileMtimeW3c(infoHtml)) ?? fallbackLastmod,
    });
  }

  for (const marca of loadMarcasList()) {
    const marcaHtml = path.join(DIST, 'marca', marca.slug, 'index.html');
    const marcaFile = fs.existsSync(marcaHtml) ? marcaHtml : PATHS.seoMarcas;
    urls.push({
      loc: absoluteUrl(BASE_URL, `/marca/${marca.slug}`),
      lastmod: fileMtimeW3c(marcaFile) ?? fallbackLastmod,
      image: OG_IMAGE,
    });
  }

  const modelPaths = seoManifest?.paths?.modelos ?? seoManifest?.modelosPaths ?? [];
  for (const rel of modelPaths) {
    const fileName = path.basename(rel, '.json');
    const dash = fileName.indexOf('-');
    if (dash <= 0) continue;
    const marcaSlug = fileName.slice(0, dash);
    const modeloSlug = fileName.slice(dash + 1);

    const modeloJson = path.join(PUBLIC, rel.replace(/^\/+/, ''));
    if (!fs.existsSync(modeloJson)) continue;

    const modeloHtml = path.join(DIST, 'modelo', marcaSlug, modeloSlug, 'index.html');
    const lastmod = fileMtimeW3c(fs.existsSync(modeloHtml) ? modeloHtml : modeloJson);

    urls.push({
      loc: absoluteUrl(BASE_URL, `/modelo/${marcaSlug}/${modeloSlug}`),
      lastmod: lastmod ?? fallbackLastmod,
      image: OG_IMAGE,
    });
  }

  const comparativos = readJson(PATHS.seoComparativos, { pares: [] });
  for (const par of comparativos.pares ?? []) {
    if (!par?.slug) continue;
    urls.push({
      loc: absoluteUrl(BASE_URL, `/comparar/${par.slug}`),
      lastmod: fallbackLastmod,
    });
  }

  const anosData = readJson(PATHS.seoAnos, { anos: [] });
  for (const a of anosData.anos ?? []) {
    if (a?.ano == null) continue;
    urls.push({
      loc: absoluteUrl(BASE_URL, `/ano/${a.ano}`),
      lastmod: fileMtimeW3c(PATHS.seoAnos) ?? fallbackLastmod,
    });
  }

  return dedupeUrls(urls);
}

/** @returns {import('./lib/sitemap-core.js').SitemapUrl[]} */
function buildSemanticUrls(seoManifest) {
  const intents = readJson(PATHS.semanticIntents, []);
  if (!Array.isArray(intents) || intents.length === 0) return [];

  const fallbackLastmod =
    toW3cDate(seoManifest?.geradoEm) ?? fileMtimeW3c(PATHS.semanticIntents);

  const modeloLastmodCache = new Map();

  function modeloLastmod(marcaSlug, modeloSlug) {
    const key = `${marcaSlug}/${modeloSlug}`;
    if (modeloLastmodCache.has(key)) return modeloLastmodCache.get(key);
    const file = path.join(PUBLIC, 'data', 'seo', 'modelos', `${marcaSlug}-${modeloSlug}.json`);
    const lm = fileMtimeW3c(file) ?? fallbackLastmod;
    modeloLastmodCache.set(key, lm);
    return lm;
  }

  return intents
    .slice()
    .sort((a, b) => (b[8] || 0) - (a[8] || 0))
    .slice(0, SEMANTIC_LIMIT)
    .map((row) => {
      const intentPath = row[4];
      if (!intentPath || typeof intentPath !== 'string') return null;
      const marcaSlug = row[0];
      const modeloSlug = row[1];
      return {
        loc: absoluteUrl(BASE_URL, intentPath.startsWith('/') ? intentPath : `/${intentPath}`),
        lastmod: modeloLastmod(marcaSlug, modeloSlug),
      };
    })
    .filter(Boolean);
}

function cleanupLegacyVehicleSitemaps(publicDir) {
  const legacy = path.join(publicDir, 'sitemap-vehicles.xml');
  if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
  for (const file of fs.readdirSync(publicDir)) {
    if (/^sitemap-vehicles-\d+\.xml$/.test(file)) {
      fs.unlinkSync(path.join(publicDir, file));
    }
  }
  if (fs.existsSync(DIST)) {
    if (fs.existsSync(path.join(DIST, 'sitemap-vehicles.xml'))) {
      fs.unlinkSync(path.join(DIST, 'sitemap-vehicles.xml'));
    }
    for (const file of fs.readdirSync(DIST)) {
      if (/^sitemap-vehicles-\d+\.xml$/.test(file)) {
        fs.unlinkSync(path.join(DIST, file));
      }
    }
  }
}

function publishSitemap(publicFile, xml) {
  writeSitemapFile(publicFile, xml);
  mirrorToDist(publicFile, DIST);
}

function main() {
  const started = Date.now();
  const seoManifest = readJson(PATHS.seoManifest, {});

  const vehicleUrls = buildVehicleUrls();
  const staticUrls = buildStaticUrls(seoManifest);
  const semanticUrls = buildSemanticUrls(seoManifest);

  cleanupLegacyVehicleSitemaps(PUBLIC);

  const indexEntries = [];

  const staticFile = path.join(PUBLIC, 'sitemap-static.xml');
  publishSitemap(staticFile, buildUrlsetXml(staticUrls, { includeImages: true }));
  indexEntries.push({ name: 'sitemap-static.xml', lastmod: maxLastmod(staticUrls) });

  const vehicleChunks = chunkArray(vehicleUrls, VEHICLE_SITEMAP_CHUNK);
  const vehicleFiles = [];
  vehicleChunks.forEach((chunk, i) => {
    const name = `sitemap-vehicles-${i + 1}.xml`;
    const file = path.join(PUBLIC, name);
    publishSitemap(file, buildUrlsetXml(chunk, { includeImages: true }));
    vehicleFiles.push(name);
    indexEntries.push({ name, lastmod: maxLastmod(chunk) });
  });

  let semanticCount = 0;
  if (semanticUrls.length > 0) {
    const semanticFile = path.join(PUBLIC, 'sitemap-semantic.xml');
    publishSitemap(semanticFile, buildUrlsetXml(semanticUrls));
    indexEntries.push({ name: 'sitemap-semantic.xml', lastmod: maxLastmod(semanticUrls) });
    semanticCount = semanticUrls.length;
  } else {
    const stale = path.join(PUBLIC, 'sitemap-semantic.xml');
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
    const staleDist = path.join(DIST, 'sitemap-semantic.xml');
    if (fs.existsSync(staleDist)) fs.unlinkSync(staleDist);
  }

  const indexXml = buildSitemapIndexXml(BASE_URL, indexEntries);
  publishSitemap(path.join(PUBLIC, 'sitemap.xml'), indexXml);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const report = {
    sitemapIndex: path.join(PUBLIC, 'sitemap.xml'),
    elapsedSec: Number(elapsed),
    total: staticUrls.length + vehicleUrls.length + semanticCount,
    static: staticUrls.length,
    vehicles: vehicleUrls.length,
    vehicleSitemaps: vehicleFiles,
    semantic: semanticCount,
    chunkSize: VEHICLE_SITEMAP_CHUNK,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
