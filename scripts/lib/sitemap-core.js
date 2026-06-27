/**
 * Utilitários compartilhados para geração de sitemaps (SEO técnico).
 */
import fs from 'fs';
import path from 'path';

export const VEHICLE_SITEMAP_CHUNK = 45_000;
/** Limite Google Search Console por arquivo de sitemap. */
export const GOOGLE_SITEMAP_URL_LIMIT = 50_000;
export const SEMANTIC_LIMIT = 10_000;

const MESES_FIPE = {
  Jan: '01',
  Fev: '02',
  Mar: '03',
  Abr: '04',
  Mai: '05',
  Jun: '06',
  Jul: '07',
  Ago: '08',
  Set: '09',
  Out: '10',
  Nov: '11',
  Dez: '12',
};

/** @typedef {{ loc: string; lastmod: string; image?: string }} SitemapUrl */

export function escXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toW3cDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

export function fileMtimeW3c(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return toW3cDate(fs.statSync(filePath).mtime);
}

export function parseMesReferencia(mesRef) {
  if (!mesRef || typeof mesRef !== 'string') return null;
  const [mes, yy] = mesRef.split('/');
  const month = MESES_FIPE[mes];
  if (!month || !yy) return null;
  const year = yy.length === 2 ? 2000 + Number.parseInt(yy, 10) : Number.parseInt(yy, 10);
  if (!Number.isFinite(year)) return null;
  return `${year}-${month}-01`;
}

/**
 * Última modificação real a partir do bundle JSON (fonte de dados / “banco”).
 * Prioridade: último ponto do histórico FIPE → lastVerified → mês referência → geradoEm.
 */
export function lastmodFromBundle(bundle) {
  const historico = bundle?.fipe?.historico;
  if (Array.isArray(historico) && historico.length > 0) {
    const lastPoint = historico[historico.length - 1];
    const fromData = toW3cDate(lastPoint?.data);
    if (fromData) return fromData;
  }

  const fromProvenance = toW3cDate(bundle?.provenance?.valorFipe?.lastVerified);
  if (fromProvenance) return fromProvenance;

  const fromMes = parseMesReferencia(bundle?.fipe?.mesReferencia);
  if (fromMes) return fromMes;

  return toW3cDate(bundle?.geradoEm);
}

export function readBundleLastmod(publicRoot, bundlePath, cache) {
  const meta = readBundleMeta(publicRoot, bundlePath, cache);
  return meta?.lastmod ?? null;
}

export function readBundleMeta(publicRoot, bundlePath, cache) {
  const rel = bundlePath.replace(/^\/+/, '');
  const full = path.join(publicRoot, rel);
  if (!fs.existsSync(full)) return null;

  if (cache?.has(full)) return cache.get(full);

  let lastmod = fileMtimeW3c(full);
  let ano = 0;
  let valor = 0;

  try {
    const bundle = JSON.parse(fs.readFileSync(full, 'utf-8'));
    lastmod = lastmodFromBundle(bundle) ?? lastmod;
    ano = bundle.identity?.ano ?? bundle.identity?.anoModelo ?? 0;
    valor = bundle.fipe?.valorAtual ?? 0;
  } catch {
    /* mantém mtime do arquivo */
  }

  const result = { lastmod, ano, valor };
  if (cache) cache.set(full, result);
  return result;
}

export function absoluteUrl(baseUrl, pathname) {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${baseUrl.replace(/\/+$/, '')}${p}`;
}

export function dedupeUrls(urls) {
  const seen = new Set();
  return urls.filter((u) => {
    if (seen.has(u.loc)) return false;
    seen.add(u.loc);
    return true;
  });
}

export function maxLastmod(urls) {
  let max = '';
  for (const u of urls) {
    if (u.lastmod && u.lastmod > max) max = u.lastmod;
  }
  return max || null;
}

export function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * @param {SitemapUrl[]} urls
 * @param {{ includeImages?: boolean }} [options]
 */
export function buildUrlsetXml(urls, options = {}) {
  const { includeImages = false } = options;
  const xmlns = includeImages
    ? ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

  const body = urls
    .map((u) => {
      const imageBlock =
        includeImages && u.image
          ? `\n    <image:image>\n      <image:loc>${escXml(u.image)}</image:loc>\n    </image:image>`
          : '';
      return `  <url>\n    <loc>${escXml(u.loc)}</loc>\n    <lastmod>${escXml(u.lastmod)}</lastmod>${imageBlock}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset${xmlns}>\n${body}\n</urlset>\n`;
}

/**
 * @param {{ name: string; lastmod: string | null }[]} files
 */
export function buildSitemapIndexXml(baseUrl, files) {
  const body = files
    .map((f) => {
      const lastmodLine = f.lastmod ? `\n    <lastmod>${escXml(f.lastmod)}</lastmod>` : '';
      return `  <sitemap>\n    <loc>${escXml(absoluteUrl(baseUrl, `/${f.name}`))}</loc>${lastmodLine}\n  </sitemap>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function writeSitemapFile(filePath, xml) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, xml, 'utf-8');
}

export function mirrorToDist(publicFile, distRoot) {
  if (!distRoot || !fs.existsSync(distRoot)) return;
  const dest = path.join(distRoot, path.basename(publicFile));
  fs.copyFileSync(publicFile, dest);
}
