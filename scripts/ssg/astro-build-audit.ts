import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'astro-ssg', 'dist');
const REPORT_PATH = path.join(ROOT, 'data', 'reports', 'astro-build-audit.json');

function countHtmlFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countHtmlFiles(full);
    else if (entry.name === 'index.html') count++;
  }
  return count;
}

function readSitemapCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const name of ['vehicles', 'families', 'generations', 'engines', 'platforms']) {
    const p = path.join(DIST, `sitemap-${name}.xml`);
    if (!fs.existsSync(p)) continue;
    const xml = fs.readFileSync(p, 'utf-8');
    out[name] = (xml.match(/<url>/g) ?? []).length;
  }
  return out;
}

function readBuildMeta(): { buildTimeMs?: number; memoryMb?: number } {
  const metaPath = path.join(DIST, '.build-meta.json');
  if (!fs.existsSync(metaPath)) return {};
  return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
}

async function main() {
  const htmlCount = countHtmlFiles(DIST);
  const sitemapUrls = readSitemapCounts();
  const buildMeta = readBuildMeta();
  const mem = process.memoryUsage();

  const report = {
    geradoEm: new Date().toISOString(),
    metricas: {
      htmlGerados: htmlCount,
      tempoBuildMs: buildMeta.buildTimeMs ?? null,
      memoriaUsadaMb: buildMeta.memoryMb ?? Math.round(mem.rss / 1024 / 1024),
      sitemapUrls,
      sitemapTotal: Object.values(sitemapUrls).reduce((a, b) => a + b, 0),
      lighthouse: 'pendente — rodar manualmente ou via CI',
      lcp: 'pendente',
      inp: 'pendente',
      cls: 'pendente',
    },
    dist: DIST,
    limits: {
      SSG_LIMIT_VEHICLES: process.env.SSG_LIMIT_VEHICLES ?? 'full',
      SSG_LIMIT_FAMILIES: process.env.SSG_LIMIT_FAMILIES ?? 'full',
      SSG_LIMIT_GENERATIONS: process.env.SSG_LIMIT_GENERATIONS ?? 'full',
    },
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
