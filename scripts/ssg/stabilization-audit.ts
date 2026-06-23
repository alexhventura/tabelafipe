/**
 * Auditoria de estabilizacao: URLs, bundles, busca, links internos.
 * Uso: npx tsx scripts/ssg/stabilization-audit.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PATHS } from '../lib/fipe-paths.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type UrlEntry = { canonicalPath: string; pageSlug: string; bundlePath: string };

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

function bundleExists(bundlePath: string): boolean {
  const rel = bundlePath.replace(/^\//, '').replace(/\//g, path.sep);
  return fs.existsSync(path.join(ROOT, 'public', rel));
}

function parseCanonicalPath(cp: string): { marca: string; slug: string } | null {
  const parts = cp.split('/').filter(Boolean);
  if (parts[0] !== 'fipe' || parts.length < 3) return null;
  return { marca: parts[1], slug: parts[2] };
}

async function main() {
  const t0 = Date.now();
  const urlMapPath = fs.existsSync(PATHS.publicVehicleUrlMap)
    ? PATHS.publicVehicleUrlMap
    : PATHS.vehicleUrlMap;
  const urlMap = loadJson<Record<string, UrlEntry>>(urlMapPath);

  let urlsValidas = 0;
  let urlsQuebradas = 0;
  const brokenSamples: string[] = [];

  for (const entry of Object.values(urlMap)) {
    if (bundleExists(entry.bundlePath)) {
      urlsValidas++;
    } else {
      urlsQuebradas++;
      if (brokenSamples.length < 30) brokenSamples.push(entry.canonicalPath);
    }
  }

  const searchManifest = loadJson<{ total: number; shards: string[] }>(PATHS.publicSearchManifest);
  let searchWithCanonical = 0;
  let searchBrokenCanonical = 0;
  const latencies: number[] = [];

  for (const shard of searchManifest.shards) {
    const items = loadJson<Array<{ cp?: string; n: string }>>(
      path.join(PATHS.publicSearchDir, `shard-${shard}.json`),
    );
    for (const item of items) {
      if (!item.cp) continue;
      searchWithCanonical++;
      const parsed = parseCanonicalPath(item.cp);
      if (!parsed) {
        searchBrokenCanonical++;
        continue;
      }
      const bundlePath = `/data/bundles/${parsed.marca}/${parsed.slug}.json`;
      if (!bundleExists(bundlePath)) searchBrokenCanonical++;
    }
  }

  let familiaHubs = 0;
  const famRoot = path.join(PATHS.hubBundlesRoot, 'familia');
  if (fs.existsSync(famRoot)) {
    for (const marca of fs.readdirSync(famRoot)) {
      const d = path.join(famRoot, marca);
      if (fs.statSync(d).isDirectory()) familiaHubs += fs.readdirSync(d).filter((f) => f.endsWith('.json')).length;
    }
  }

  let internalBroken = 0;
  const internalSamples: string[] = [];
  const bundleFiles = fs.existsSync(PATHS.vehicleBundlesRoot)
    ? fs.readdirSync(PATHS.vehicleBundlesRoot, { recursive: true } as fs.ReaddirSyncOptions).filter(
        (f): f is string => typeof f === 'string' && f.endsWith('.json'),
      )
    : [];

  const sampleBundles = bundleFiles.slice(0, 500);
  for (const rel of sampleBundles) {
    const full = path.join(PATHS.vehicleBundlesRoot, rel);
    const bundle = loadJson<{ related?: Record<string, Array<{ canonicalPath: string }>> }>(full);
    if (!bundle.related) continue;
    for (const links of Object.values(bundle.related)) {
      for (const link of links) {
        const parsed = parseCanonicalPath(link.canonicalPath);
        if (!parsed) continue;
        const bp = `/data/bundles/${parsed.marca}/${parsed.slug}.json`;
        if (!bundleExists(bp)) {
          internalBroken++;
          if (internalSamples.length < 20) internalSamples.push(link.canonicalPath);
        }
      }
    }
  }

  const queries = ['S', 'Co', 'Str', 'Corolla', '002112-1'];
  const { searchVehicles, normalizeText, benchmarkSearch } = await import('../../src/lib/search.ts');

  const allSearchItems: import('../../src/types.ts').SearchIndexItem[] = [];
  const seenIds = new Set<string>();
  for (const shard of searchManifest.shards) {
    const shardData = loadJson<
      Array<{ i: string; n: string; m: string; a: number; v: number; t: string; c?: string; s: string; mo?: string; cp?: string; f?: string }>
    >(path.join(PATHS.publicSearchDir, `shard-${shard}.json`));
    for (const row of shardData) {
      if (seenIds.has(row.i)) continue;
      seenIds.add(row.i);
      allSearchItems.push({
        id: row.i,
        nome: row.n,
        marca: row.m,
        ano: row.a,
        valor: row.v,
        tipo: row.t as 'carros',
        combustivel: row.c,
        termoBusca: row.s,
        modelo: row.mo,
        searchText: normalizeText(row.mo ? `${row.m} ${row.mo}` : row.n),
        fipeCodigo: row.f,
        canonicalPath: row.cp,
      });
    }
  }

  const shardSItems = loadJson<
    Array<{ i: string; n: string; m: string; a: number; v: number; t: string; c?: string; s: string; mo?: string; cp?: string; f?: string }>
  >(path.join(PATHS.publicSearchDir, 'shard-s.json'));
  const sIndex: import('../../src/types.ts').SearchIndexItem[] = shardSItems.map((row) => ({
    id: row.i,
    nome: row.n,
    marca: row.m,
    ano: row.a,
    valor: row.v,
    tipo: row.t as 'carros',
    combustivel: row.c,
    termoBusca: row.s,
    modelo: row.mo,
    searchText: normalizeText(row.mo ? `${row.m} ${row.mo}` : row.n),
    fipeCodigo: row.f,
    canonicalPath: row.cp,
  }));

  const searchBench: Record<string, { count: number; ms: number }> = {};
  for (const q of queries) {
    const benchIndex = q.length <= 4 && !/\s/.test(q) ? sIndex : allSearchItems;
    const r = benchmarkSearch(benchIndex, q, 'carros');
    searchBench[q] = r;
    latencies.push(r.ms);
  }

  const sResults = searchVehicles(sIndex, 'S', 'carros', 20);
  const sModels = sResults.map((r) => (r.modelo ?? r.nome).toLowerCase()).join(' ');

  const report = {
    geradoEm: new Date().toISOString(),
    duracaoMs: Date.now() - t0,
    veiculos: {
      urlMapTotal: Object.keys(urlMap).length,
      urlsValidas,
      urlsQuebradas,
      brokenSamples,
    },
    busca: {
      veiculosIndexados: searchManifest.total,
      familiasIndexadas: familiaHubs,
      shards: searchManifest.shards.length,
      comCanonicalPath: searchWithCanonical,
      canonicalQuebrados: searchBrokenCanonical,
      latenciaMediaMs: latencies.length ? Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100 : 0,
      benchmarks: searchBench,
      prefixoS: {
        total: sResults.length,
        amostra: sResults.slice(0, 8).map((r) => r.nome),
        temSandero: sModels.includes('sandero'),
        temSaveiro: sModels.includes('saveiro'),
        temSentra: sModels.includes('sentra'),
      },
    },
    linksInternos: {
      bundlesAmostrados: sampleBundles.length,
      linksQuebrados: internalBroken,
      amostras: internalSamples,
    },
    metas: {
      urlsQuebradasZero: urlsQuebradas === 0,
      buscaPrefixoS:
        sModels.includes('sandero') &&
        sModels.includes('saveiro') &&
        sModels.includes('sentra'),
    },
  };

  const outPath = path.join(PATHS.reportsRoot, 'stabilization-audit.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
