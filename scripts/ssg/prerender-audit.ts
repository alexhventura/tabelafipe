/**
 * Audita HTML pré-renderizado em dist/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');

function countHtml(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countHtml(full);
    else if (entry.name.endsWith('.html')) n += 1;
  }
  return n;
}

function readSampleVehicleHtml(): string | null {
  const fipeDir = path.join(DIST, 'fipe');
  if (!fs.existsSync(fipeDir)) return null;
  for (const marca of fs.readdirSync(fipeDir)) {
    const marcaDir = path.join(fipeDir, marca);
    if (!fs.statSync(marcaDir).isDirectory()) continue;
    for (const slug of fs.readdirSync(marcaDir)) {
      const file = path.join(marcaDir, slug, 'index.html');
      if (!fs.existsSync(file)) continue;
      const html = fs.readFileSync(file, 'utf-8');
      if (html.includes('data-prerender="vehicle"')) return html;
    }
  }
  return null;
}

function resolveMinVehicles(): number {
  const limit = Number.parseInt(process.env.SSG_LIMIT_VEHICLES ?? '', 10);
  if (Number.isFinite(limit) && limit > 0) {
    return Math.max(10, Math.floor(limit * 0.9));
  }
  return Number.parseInt(process.env.SSG_AUDIT_MIN_VEHICLES ?? '45000', 10);
}

function main(): void {
  const total = countHtml(DIST);
  const vehicles = countHtml(path.join(DIST, 'fipe'));
  const sample = readSampleVehicleHtml();

  const checks = {
    totalHtml: total,
    vehicleHtml: vehicles,
    hasGeneratorMeta: sample?.includes('name="generator" content="spa-prerender"') ?? false,
    hasH1: sample?.includes('<h1>') ?? false,
    hasJsonLd: sample?.includes('application/ld+json') ?? false,
    hasRootContent: sample?.includes('data-prerender="vehicle"') ?? false,
    hasReactScripts: sample?.includes('/assets/') ?? false,
  };

  console.log('=== Prerender Audit ===');
  console.log(JSON.stringify(checks, null, 2));

  const minVehicles = resolveMinVehicles();
  if (vehicles < minVehicles) {
    console.error(`Falha: esperado >= ${minVehicles} HTML de veículos, obtido ${vehicles}`);
    process.exit(1);
  }
  if (!checks.hasH1 || !checks.hasReactScripts) {
    console.error('Falha: HTML de amostra incompleto');
    process.exit(1);
  }
  console.log('OK');
}

main();
