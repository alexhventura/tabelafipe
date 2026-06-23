/**
 * Auditoria UX: jornada do usuário, seções, hubs e links internos.
 * Uso: npx tsx scripts/ssg/ux-journey-audit.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PATHS } from '../lib/fipe-paths.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type UrlEntry = { canonicalPath: string; pageSlug: string; bundlePath: string };

type VehicleBundle = {
  identity: { displayName: string; vehicleId: string };
  fipe: { valorAtual: number; historico: unknown[] };
  related?: Record<string, Array<{ canonicalPath: string }>>;
};

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

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

async function main() {
  const t0 = Date.now();
  const urlMapPath = fs.existsSync(PATHS.publicVehicleUrlMap)
    ? PATHS.publicVehicleUrlMap
    : PATHS.vehicleUrlMap;
  const urlMap = loadJson<Record<string, UrlEntry>>(urlMapPath);

  let urlsValidas = 0;
  let urlsQuebradas = 0;
  const brokenUrlSamples: string[] = [];

  for (const entry of Object.values(urlMap)) {
    if (bundleExists(entry.bundlePath)) urlsValidas++;
    else {
      urlsQuebradas++;
      if (brokenUrlSamples.length < 20) brokenUrlSamples.push(entry.canonicalPath);
    }
  }

  const famRoot = path.join(PATHS.hubBundlesRoot, 'familia');
  const familiaHubFiles = listJsonFiles(famRoot);
  let hubsVazios = 0;
  let hubsSemStats = 0;
  const hubEmptySamples: string[] = [];

  for (const file of familiaHubFiles) {
    const hub = loadJson<{ veiculos?: unknown[]; stats?: { total?: number } }>(file);
    const count = hub.veiculos?.length ?? 0;
    if (count < 2) {
      hubsVazios++;
      if (hubEmptySamples.length < 15) hubEmptySamples.push(path.relative(famRoot, file));
    }
    if (!hub.stats?.total) hubsSemStats++;
  }

  const bundleRoot = PATHS.vehicleBundlesRoot;
  const allBundleFiles = listJsonFiles(bundleRoot);
  const sampleSize = Math.min(800, allBundleFiles.length);
  const step = Math.max(1, Math.floor(allBundleFiles.length / sampleSize));
  const sampledBundles = allBundleFiles.filter((_, i) => i % step === 0).slice(0, sampleSize);

  let internalBroken = 0;
  const internalSamples: string[] = [];
  let semPreco = 0;
  let semHistorico = 0;
  let semFaq = 0;
  let semConcorrentes = 0;
  let concorrentesMesmaFamilia = 0;

  const { pickConcorrentes, buildEnhancedFaq, buildVehicleBreadcrumb } = await import(
    '../../src/lib/vehiclePageData.ts'
  );

  for (const full of sampledBundles) {
    const bundle = loadJson<VehicleBundle>(full);
    if (!bundle.fipe?.valorAtual) semPreco++;
    if (!bundle.fipe?.historico || bundle.fipe.historico.length < 2) semHistorico++;
    if (!buildEnhancedFaq(bundle as never).length) semFaq++;

    const concorrentes = pickConcorrentes(bundle as never);
    if (!concorrentes.length) semConcorrentes++;
    const familiaTokens = bundle.identity.displayName.toLowerCase().split(/\s+/).slice(1, 2);
    for (const c of concorrentes) {
      const name = c.displayName.toLowerCase();
      if (familiaTokens.some((t) => t.length >= 4 && name.includes(t))) concorrentesMesmaFamilia++;
    }

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

  let breadcrumbIncompleto = 0;
  for (const full of sampledBundles.slice(0, 200)) {
    const bundle = loadJson<VehicleBundle>(full);
    const crumbs = buildVehicleBreadcrumb(bundle as never);
    if (crumbs.length < 4) breadcrumbIncompleto++;
  }

  const searchManifest = loadJson<{ total: number; shards: string[] }>(PATHS.publicSearchManifest);
  const { searchVehicles, searchFamilies, normalizeText, benchmarkSearch } = await import('../../src/lib/search.ts');

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

  let familiesManifest: { total: number; shards: string[] } = { total: 0, shards: [] };
  const allFamilies: import('../../src/types.ts').FamilySearchItem[] = [];
  const famManifestPath = path.join(PATHS.publicSearchDir, 'families-manifest.json');
  if (fs.existsSync(famManifestPath)) {
    familiesManifest = loadJson(famManifestPath);
    for (const shard of familiesManifest.shards) {
      const shardPath = path.join(PATHS.publicSearchDir, `family-shard-${shard}.json`);
      if (!fs.existsSync(shardPath)) continue;
      const rows = loadJson<
        Array<{
          id: string;
          fa: string;
          fd: string;
          m: string;
          md: string;
          t: string;
          n: number;
          vmin: number;
          vmax: number;
          amin: number;
          amax: number;
          cp?: string;
        }>
      >(shardPath);
      for (const row of rows) {
        allFamilies.push({
          id: row.id,
          familia: row.fa,
          familiaDisplay: row.fd,
          marca: row.md,
          marcaSlug: row.m,
          tipo: row.t as 'carros',
          versaoCount: row.n,
          valorMin: row.vmin,
          valorMax: row.vmax,
          anoMin: row.amin,
          anoMax: row.amax,
          hubPath: row.cp,
        });
      }
    }
  }

  const journeyQueries = ['Corolla', '002112-1'];
  const journeySteps: Record<string, { ms: number; detail: string }> = {};

  for (const q of journeyQueries) {
    const searchStart = performance.now();
    const vehicleResults = searchVehicles(allSearchItems, q, 'carros', 5);
    const familyResults = searchFamilies(allFamilies, q, 'carros', 3);
    const searchMs = performance.now() - searchStart;
    journeySteps[q] = {
      ms: Math.round(searchMs * 100) / 100,
      detail: `${vehicleResults.length} veículos, ${familyResults.length} famílias`,
    };
  }

  const corollaBench = benchmarkSearch(allFamilies, allSearchItems, 'Corolla', 'carros');
  const corollaHubPath = path.join(famRoot, 'toyota', 'corolla.json');
  const corollaHubExists = fs.existsSync(corollaHubPath);

  const corollaSample = Object.values(urlMap).find(
    (e) => e.canonicalPath.includes('corolla') && e.canonicalPath.includes('2024'),
  );
  let corollaBundleMs = 0;
  if (corollaSample && bundleExists(corollaSample.bundlePath)) {
    const readStart = performance.now();
    const rel = corollaSample.bundlePath.replace(/^\//, '');
    loadJson(path.join(ROOT, 'public', rel.replace(/\//g, path.sep)));
    corollaBundleMs = performance.now() - readStart;
  }

  const tempoBuscaMs = journeySteps.Corolla?.ms ?? corollaBench.ms;
  const tempoAtePrecoEstimadoMs = Math.round((tempoBuscaMs + corollaBundleMs + 120) * 100) / 100;
  const tempoAteHistoricoEstimadoMs = Math.round((tempoAtePrecoEstimadoMs + 80) * 100) / 100;
  const tempoJornadaCompletaEstimadoMs =
    Math.round((tempoBuscaMs + 150 + corollaBundleMs + 100) * 100) / 100;

  const report = {
    geradoEm: new Date().toISOString(),
    duracaoMs: Date.now() - t0,
    homepage: {
      searchIndexCarregado: searchManifest.total > 0,
      familiasIndexadas: familiesManifest.total || allFamilies.length,
    },
    urls: {
      total: Object.keys(urlMap).length,
      validas: urlsValidas,
      quebradas: urlsQuebradas,
      amostrasQuebradas: brokenUrlSamples,
    },
    hubsFamilia: {
      total: familiaHubFiles.length,
      vazios: hubsVazios,
      semStats: hubsSemStats,
      amostrasVazios: hubEmptySamples,
      corollaHubExiste: corollaHubExists,
    },
    paginaVeiculo: {
      bundlesAmostrados: sampledBundles.length,
      semPreco,
      semHistorico,
      semFaq,
      semConcorrentes,
      concorrentesMesmaFamilia,
      breadcrumbIncompleto,
    },
    linksInternos: {
      quebrados: internalBroken,
      amostras: internalSamples,
    },
    jornada: {
      metaSegundos: 10,
      buscaCorollaMs: tempoBuscaMs,
      loadBundleCorollaMs: Math.round(corollaBundleMs * 100) / 100,
      tempoAtePrecoEstimadoMs,
      tempoAteHistoricoEstimadoMs,
      tempoJornadaCompletaEstimadoMs,
      dentroDaMeta10s: tempoJornadaCompletaEstimadoMs < 10000,
      queries: journeySteps,
    },
    metas: {
      zeroUrlsQuebradas: urlsQuebradas === 0,
      zeroLinksInternosQuebrados: internalBroken === 0,
      zeroHubsVazios: hubsVazios === 0,
      jornadaMenor10s: tempoJornadaCompletaEstimadoMs < 10000,
      breadcrumbCompleto: breadcrumbIncompleto === 0,
    },
    notas: [
      'Tempos de jornada são estimativas (busca + leitura de bundle + render).',
      'Validação mobile depende de teste manual ou Lighthouse.',
      'concorrentesMesmaFamilia > 0 indica vazamento de versões da mesma família.',
    ],
  };

  const outPath = path.join(PATHS.reportsRoot, 'ux-journey-audit.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
