/**
 * Auditoria da jornada: Home → busca → clique → preço visível.
 * Meta: ≤ 5 segundos (busca + bundle + render estimado).
 * Uso: npx tsx scripts/ssg/search-journey-audit.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PATHS } from '../lib/fipe-paths.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const META_MS = 5000;
const RENDER_ESTIMATE_MS = 150;

type JourneyCase = {
  query: string;
  expectInTitle?: string[];
  expectYear?: number;
  expectFipePrefix?: string;
  minResults?: number;
};

const JOURNEY_CASES: JourneyCase[] = [
  { query: 'Corolla XEi 2024', expectInTitle: ['Corolla', 'XEi'], expectYear: 2024 },
  { query: 'Corolla', expectInTitle: ['Corolla'], minResults: 3 },
  { query: '002112-1', expectFipePrefix: '002112-1' },
  { query: 'Onix', expectInTitle: ['Onix'] },
  { query: 'Gol', expectInTitle: ['Gol'] },
];

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

function bundleExists(bundlePath: string): boolean {
  const rel = bundlePath.replace(/^\//, '').replace(/\//g, path.sep);
  return fs.existsSync(path.join(ROOT, 'public', rel));
}

async function main() {
  const t0 = Date.now();
  const {
    searchSuggestions,
    formatVehicleSuggestionTitle,
    formatVehicleSuggestionSubtitle,
    normalizeText,
    isHighConfidenceMatch,
  } = await import('../../src/lib/search.ts');

  const searchDir = PATHS.publicSearchDir;
  const manifest = loadJson<{ shards: string[] }>(path.join(searchDir, 'manifest.json'));

  const vehicles: import('../../src/types.ts').SearchIndexItem[] = [];
  const seenIds = new Set<string>();
  for (const shard of manifest.shards) {
    const rows = loadJson<
      Array<{ i: string; n: string; m: string; a: number; v: number; t: string; c?: string; s: string; mo?: string; f?: string; cp?: string }>
    >(path.join(searchDir, `shard-${shard}.json`));
    for (const row of rows) {
      if (seenIds.has(row.i)) continue;
      seenIds.add(row.i);
      vehicles.push({
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

  const families: import('../../src/types.ts').FamilySearchItem[] = [];
  const famManifestPath = path.join(searchDir, 'families-manifest.json');
  if (fs.existsSync(famManifestPath)) {
    const famManifest = loadJson<{ shards: string[] }>(famManifestPath);
    for (const shard of famManifest.shards) {
      const rows = loadJson<
        Array<{ id: string; fa: string; fd: string; m: string; md: string; t: string; n: number; vmin: number; vmax: number; amin: number; amax: number; cp?: string }>
      >(path.join(searchDir, `family-shard-${shard}.json`));
      for (const row of rows) {
        families.push({
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

  const caseResults: Array<{
    query: string;
    ok: boolean;
    searchMs: number;
    bundleMs: number;
    journeyMs: number;
    topTitle: string;
    topSubtitle: string;
    canonicalPath?: string;
    bundleOk: boolean;
    hasPrice: boolean;
    issues: string[];
  }> = [];

  for (const c of JOURNEY_CASES) {
    const issues: string[] = [];
    const searchStart = performance.now();
    const results = searchSuggestions(families, vehicles, c.query, 'carros', 10);
    const searchMs = performance.now() - searchStart;

    if (!results.length) issues.push('nenhum resultado');
    const minResults = c.minResults ?? 1;
    if (results.length < minResults) issues.push(`menos de ${minResults} resultados`);

    const top = results[0];
    const topTitle = top ? formatVehicleSuggestionTitle(top.item) : '';
    const topSubtitle = top ? formatVehicleSuggestionSubtitle(top.item) : '';

    if (top && c.expectInTitle) {
      const titleLower = topTitle.toLowerCase();
      for (const needle of c.expectInTitle) {
        if (!titleLower.includes(needle.toLowerCase())) issues.push(`titulo sem "${needle}"`);
      }
    }
    if (top && c.expectYear && top.item.ano !== c.expectYear) {
      issues.push(`ano esperado ${c.expectYear}, obteve ${top.item.ano}`);
    }
    if (top && c.expectFipePrefix && !top.item.fipeCodigo?.startsWith(c.expectFipePrefix.split('-')[0])) {
      issues.push('codigo FIPE inesperado');
    }
    if (top && topTitle.split(/\s+/).length < 3 && c.query.length > 2) {
      issues.push('titulo curto demais (possivel label de familia)');
    }
    if (top && !topSubtitle.includes('FIPE')) {
      issues.push('subtitulo sem codigo FIPE');
    }
    if (top && !top.item.canonicalPath) issues.push('sem canonicalPath');

    let bundleMs = 0;
    let bundleOk = false;
    let hasPrice = false;

    if (top?.item.canonicalPath) {
      const urlMapPath = fs.existsSync(PATHS.publicVehicleUrlMap)
        ? PATHS.publicVehicleUrlMap
        : PATHS.vehicleUrlMap;
      const urlMap = loadJson<Record<string, { bundlePath: string; canonicalPath: string }>>(urlMapPath);
      const entry = Object.values(urlMap).find((e) => e.canonicalPath === top.item.canonicalPath);
      if (!entry) {
        issues.push('URL nao encontrada no mapa');
      } else if (!bundleExists(entry.bundlePath)) {
        issues.push('bundle inexistente');
      } else {
        const readStart = performance.now();
        const rel = entry.bundlePath.replace(/^\//, '');
        const bundle = loadJson<{ fipe?: { valorAtual?: number } }>(
          path.join(ROOT, 'public', rel.replace(/\//g, path.sep)),
        );
        bundleMs = performance.now() - readStart;
        bundleOk = true;
        hasPrice = (bundle.fipe?.valorAtual ?? 0) > 0;
        if (!hasPrice) issues.push('bundle sem preco');
      }
    }

    const journeyMs = searchMs + bundleMs + RENDER_ESTIMATE_MS;
    if (journeyMs > META_MS) issues.push(`jornada ${journeyMs.toFixed(0)}ms > meta ${META_MS}ms`);

    if (c.query === 'Corolla XEi 2024' && top && !isHighConfidenceMatch(results)) {
      issues.push('esperava alta confianca para query exata');
    }

    caseResults.push({
      query: c.query,
      ok: issues.length === 0,
      searchMs: Math.round(searchMs * 10) / 10,
      bundleMs: Math.round(bundleMs * 10) / 10,
      journeyMs: Math.round(journeyMs * 10) / 10,
      topTitle: topTitle.slice(0, 80),
      topSubtitle,
      canonicalPath: top?.item.canonicalPath,
      bundleOk,
      hasPrice,
      issues,
    });
  }

  const corollaCase = caseResults.find((r) => r.query === 'Corolla XEi 2024');
  const browseStart = performance.now();
  const browseResults = searchSuggestions(families, vehicles, 'Co', 'carros', 10);
  const browseMs = performance.now() - browseStart;
  const browseTitles = browseResults.map((r) => formatVehicleSuggestionTitle(r.item));
  const browseFullNames = browseTitles.every((t) => t.split(/\s+/).length >= 3);

  const report = {
    geradoEm: new Date().toISOString(),
    duracaoMs: Date.now() - t0,
    metaJornadaMs: META_MS,
    veiculosIndexados: vehicles.length,
    familiasIndexadas: families.length,
    jornadaPrincipal: corollaCase,
    dentroDaMeta5s: corollaCase ? corollaCase.journeyMs <= META_MS : false,
    casos: caseResults,
    browseCo: {
      ms: Math.round(browseMs * 10) / 10,
      count: browseResults.length,
      titulosCompletos: browseFullNames,
      amostra: browseResults.slice(0, 3).map((r) => ({
        titulo: formatVehicleSuggestionTitle(r.item),
        subtitulo: formatVehicleSuggestionSubtitle(r.item),
      })),
    },
    metas: {
      todosCasosOk: caseResults.every((r) => r.ok),
      jornadaCorollaXei2024Menor5s: corollaCase ? corollaCase.journeyMs <= META_MS : false,
      browseMostraNomesCompletos: browseFullNames,
      zeroBundlesQuebrados: caseResults.every((r) => !r.canonicalPath || r.bundleOk),
    },
  };

  const outPath = path.join(PATHS.reportsRoot, 'search-journey-audit.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.metas.todosCasosOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
