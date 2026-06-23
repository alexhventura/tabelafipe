import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SSG_LIMITS } from './config';
import type { HubBundle, UrlEntry, VehicleBundle } from './types';

const ASTRO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECT_ROOT = path.resolve(ASTRO_ROOT, '..');

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

let urlMapCache: Record<string, UrlEntry> | null = null;

export function loadUrlMap(): Record<string, UrlEntry> {
  if (!urlMapCache) {
    const candidates = [
      path.join(PROJECT_ROOT, 'public', 'data', 'vehicle-url-map.json'),
      path.join(PROJECT_ROOT, 'data', 'generated', 'vehicle-url-map.json'),
    ];
    const p = candidates.find((c) => fs.existsSync(c));
    if (!p) throw new Error('vehicle-url-map.json not found in public/data or data/generated');
    urlMapCache = loadJson(p);
  }
  return urlMapCache;
}

export function loadVehicleBundle(marca: string, pageSlug: string): VehicleBundle | null {
  const p = path.join(PROJECT_ROOT, 'public', 'data', 'bundles', marca, `${pageSlug}.json`);
  if (!fs.existsSync(p)) return null;
  return loadJson<VehicleBundle>(p);
}

export function loadFamilyHub(marca: string, slug: string): HubBundle | null {
  const p = path.join(PROJECT_ROOT, 'public', 'data', 'hubs', 'familia', marca, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  return loadJson<HubBundle>(p);
}

export function getVehiclePaths(): { marca: string; slug: string }[] {
  const map = loadUrlMap();
  const paths: { marca: string; slug: string }[] = [];
  for (const entry of Object.values(map)) {
    const parts = entry.canonicalPath.split('/').filter(Boolean);
    if (parts[0] !== 'fipe' || parts.length < 3) continue;
    paths.push({ marca: parts[1], slug: parts[2] });
  }
  return paths.slice(0, SSG_LIMITS.vehicles);
}

export function getFamilyPaths(): { marca: string; slug: string }[] {
  const root = path.join(PROJECT_ROOT, 'public', 'data', 'hubs', 'familia');
  const paths: { marca: string; slug: string }[] = [];
  for (const marca of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    const marcaDir = path.join(root, marca);
    if (!fs.statSync(marcaDir).isDirectory()) continue;
    for (const file of fs.readdirSync(marcaDir)) {
      if (!file.endsWith('.json')) continue;
      paths.push({ marca, slug: file.replace(/\.json$/, '') });
    }
  }
  return paths.slice(0, SSG_LIMITS.families);
}

export function getGenerationPaths(): { marca: string; geracaoSlug: string }[] {
  const root = path.join(PROJECT_ROOT, 'public', 'data', 'hubs', 'geracao');
  const paths: { marca: string; geracaoSlug: string }[] = [];
  for (const marca of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    const marcaDir = path.join(root, marca);
    if (!fs.statSync(marcaDir).isDirectory()) continue;
    for (const file of fs.readdirSync(marcaDir)) {
      if (!file.endsWith('.json')) continue;
      paths.push({ marca, geracaoSlug: file.replace(/\.json$/, '') });
    }
  }
  return paths.slice(0, SSG_LIMITS.generations);
}

export function getMotorPaths(): { engineSlug: string }[] {
  const root = path.join(PROJECT_ROOT, 'public', 'data', 'hubs', 'motor');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ engineSlug: f.replace(/\.json$/, '') }))
    .slice(0, SSG_LIMITS.engines);
}

export function getPlatformPaths(): { platformSlug: string }[] {
  const root = path.join(PROJECT_ROOT, 'public', 'data', 'hubs', 'plataforma');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ platformSlug: f.replace(/\.json$/, '') }))
    .slice(0, SSG_LIMITS.platforms);
}

export function loadGenerationHub(marca: string, geracaoSlug: string): HubBundle | null {
  const p = path.join(PROJECT_ROOT, 'public', 'data', 'hubs', 'geracao', marca, `${geracaoSlug}.json`);
  if (!fs.existsSync(p)) return null;
  return loadJson<HubBundle>(p);
}

export function loadMotorHub(engineSlug: string): HubBundle | null {
  const p = path.join(PROJECT_ROOT, 'public', 'data', 'hubs', 'motor', `${engineSlug}.json`);
  if (!fs.existsSync(p)) return null;
  return loadJson<HubBundle>(p);
}

export function loadPlatformHub(platformSlug: string): HubBundle | null {
  const p = path.join(PROJECT_ROOT, 'public', 'data', 'hubs', 'plataforma', `${platformSlug}.json`);
  if (!fs.existsSync(p)) return null;
  return loadJson<HubBundle>(p);
}

export function getAllCanonicalUrls(): {
  vehicles: string[];
  families: string[];
  generations: string[];
  engines: string[];
  platforms: string[];
} {
  const vehicles = getVehiclePaths().map((p) => `/fipe/${p.marca}/${p.slug}/`);
  const families = getFamilyPaths().map((p) => `/fipe/${p.marca}/${p.slug}/`);
  const generations = getGenerationPaths().map((p) => `/geracao/${p.marca}/${p.geracaoSlug}/`);
  const engines = getMotorPaths().map((p) => `/motor/${p.engineSlug}/`);
  const platforms = getPlatformPaths().map((p) => `/plataforma/${p.platformSlug}/`);
  return { vehicles, families, generations, engines, platforms };
}

export { PROJECT_ROOT };
