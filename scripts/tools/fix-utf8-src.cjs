const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

const bundleTs = `import type { HistoricoPonto, VehiclePageBundle } from '../types/bundle';

export type VehicleUrlMapEntry = {
  bundlePath: string;
  canonicalPath: string;
  pageSlug: string;
};

let urlMapCache: Record<string, VehicleUrlMapEntry> | null = null;

async function loadUrlMap(): Promise<Record<string, VehicleUrlMapEntry>> {
  if (urlMapCache) return urlMapCache;
  try {
    const res = await fetch('/data/vehicle-url-map.json');
    if (res.ok) {
      urlMapCache = await res.json();
      return urlMapCache!;
    }
  } catch {
    /* fallback below */
  }
  urlMapCache = {};
  return urlMapCache;
}

export async function loadVehicleBundle(
  marcaSlug: string,
  slug: string,
): Promise<VehiclePageBundle | null> {
  const cleanSlug = slug.replace(/\\/$/, '');
  const direct = \`/data/bundles/\${marcaSlug}/\${cleanSlug}.json\`;
  try {
    const res = await fetch(direct);
    if (res.ok) return (await res.json()) as VehiclePageBundle;
  } catch {
    /* try url map fallback */
  }

  const map = await loadUrlMap();
  const entry =
    map[cleanSlug] ?? Object.values(map).find((e) => e.pageSlug === cleanSlug);
  if (entry?.bundlePath) {
    const res = await fetch(entry.bundlePath);
    if (res.ok) return (await res.json()) as VehiclePageBundle;
  }

  return null;
}

export async function loadFamilyHub(marcaSlug: string, familiaSlug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(\`/data/hubs/familia/\${marcaSlug}/\${familiaSlug}.json\`);
    if (res.ok) return (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return null;
}

export function historicoToChartData(historico: HistoricoPonto[]): { mes: string; valor: number }[] {
  return historico.map((h) => ({
    mes: h.referencia ?? h.mes ?? '',
    valor: h.valor,
  }));
}
`;

fs.writeFileSync(path.join(ROOT, 'src/lib/bundle.ts'), bundleTs, 'utf8');

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      const b = fs.readFileSync(p);
      if (b.length > 1 && b[1] === 0) {
        fs.writeFileSync(p, Buffer.from(b.toString('utf16le')), 'utf8');
        console.log('converted', p);
      }
    }
  }
}

walk(path.join(ROOT, 'src'));
console.log('done');
