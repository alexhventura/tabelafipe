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
  const mapPath = path.join(ROOT, 'public', 'data', 'vehicle-url-map.json');
  if (!fs.existsSync(mapPath)) return null;

  const urlMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8')) as Record<
    string,
    { canonicalPath?: string }
  >;
  const entry = Object.values(urlMap).find((e) => e.canonicalPath);
  if (!entry?.canonicalPath) return null;

  const clean = entry.canonicalPath.replace(/\/+$/, '').replace(/^\//, '');
  const file = path.join(DIST, clean, 'index.html');
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf-8');
}

function readSampleMarcaHtml(): string | null {
  const marcaDir = path.join(DIST, 'marca', 'toyota');
  const file = path.join(marcaDir, 'index.html');
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf-8');
}

function readSampleModeloHtml(): string | null {
  const file = path.join(DIST, 'modelo', 'volkswagen', 'gol', 'index.html');
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf-8');
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

  const sampleMarca = readSampleMarcaHtml();
  const sampleModelo = readSampleModeloHtml();

  const checks = {
    totalHtml: total,
    vehicleHtml: vehicles,
    hasGeneratorMeta: sample?.includes('name="generator" content="spa-prerender"') ?? false,
    hasH1: sample?.includes('<h1') ?? false,
    hasJsonLd: sample?.includes('application/ld+json') ?? false,
    hasVehiclePrerender: sample?.includes('data-prerender="vehicle"') ?? false,
    hasVehicleBundleEmbed: sample?.includes('id="__VEHICLE_BUNDLE__"') ?? false,
    hasAppShell: sample?.includes('class="min-h-screen') ?? false,
    hasStaticFooter: sample?.includes('<footer class="border-t') ?? false,
    hasReactScripts: sample?.includes('/assets/') ?? false,
    adPlaceholderCount: sample ? (sample.match(/data-ad-placeholder="true"/g) ?? []).length : 0,
    marcaHtml: countHtml(path.join(DIST, 'marca')),
    modeloHtml: countHtml(path.join(DIST, 'modelo')),
    hasMarcaPrerender: sampleMarca?.includes('data-prerender="marca"') ?? false,
    hasModeloPrerender: sampleModelo?.includes('data-prerender="modelo"') ?? false,
    hasMarcaEmbed: sampleMarca?.includes('id="__MARCA_DATA__"') ?? false,
    hasModeloEmbed: sampleModelo?.includes('id="__MODELO_DATA__"') ?? false,
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
  if (
    !checks.hasVehiclePrerender ||
    !checks.hasVehicleBundleEmbed ||
    !checks.hasAppShell ||
    !checks.hasStaticFooter
  ) {
    console.error(
      'Falha: HTML de veículo sem shell SSG completo (prerender, bundle embed, min-h-screen ou footer)',
    );
    process.exit(1);
  }
  if (checks.marcaHtml < 50) {
    console.error(`Falha: esperado >= 50 HTML de marcas, obtido ${checks.marcaHtml}`);
    process.exit(1);
  }
  if (checks.modeloHtml < 500) {
    console.error(`Falha: esperado >= 500 HTML de modelos, obtido ${checks.modeloHtml}`);
    process.exit(1);
  }
  if (!checks.hasMarcaPrerender || !checks.hasMarcaEmbed) {
    console.error('Falha: amostra /marca/toyota sem shell SSG ou embed JSON');
    process.exit(1);
  }
  if (!checks.hasModeloPrerender || !checks.hasModeloEmbed) {
    console.error('Falha: amostra /modelo/volkswagen/gol sem shell SSG ou embed JSON');
    process.exit(1);
  }
  if (checks.adPlaceholderCount < 3) {
    console.error(`Falha: esperado >= 3 placeholders AdSense no HTML de veículo, obtido ${checks.adPlaceholderCount}`);
    process.exit(1);
  }
  console.log('OK');
}

main();
