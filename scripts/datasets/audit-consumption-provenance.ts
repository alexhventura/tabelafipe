/**
 * Auditoria de consumo e proveniência: compara Bundle × PBEV × Specs Master × Engine Master.
 *
 * Uso: npx tsx scripts/datasets/audit-consumption-provenance.ts [--limit N] [--marca nissan]
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import { SourceRegistry } from '../lib/enrichment/source-loaders.js';
import type { FipeVehicle } from '../lib/enrichment/types.js';
import { matchInmetroForVehicleWithMeta } from '../lib/enrichment/inmetro-match.js';
import { confidenceLabel } from '../lib/provenance.js';

interface Cli {
  limit: number;
  marca?: string;
}

function parseArgs(): Cli {
  const args = process.argv.slice(2);
  let limit = 0;
  let marca: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) limit = Number(args[++i]) || 0;
    if (args[i] === '--marca' && args[i + 1]) marca = args[++i]?.toLowerCase();
  }
  return { limit, marca };
}

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

interface ConflictRow {
  vehicleId: string;
  displayName: string;
  bundleCidade: number | null;
  pbevCidade: number | null;
  specsCidade: number | null;
  engineCidade: number | null;
  bundleMatchTier?: string;
  pbevMatchKey?: string;
  delta: number | null;
  severity: 'critical' | 'warning' | 'info';
  note: string;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

async function main() {
  const { limit, marca } = parseArgs();
  const started = Date.now();

  const catalog = loadJson<FipeVehicle[]>(PATHS.srcVeiculos).map((v) => normalizeVehicle(v));
  let vehicles = marca ? catalog.filter((v) => v.marcaSlug === marca || v.marca.toLowerCase() === marca) : catalog;
  if (limit > 0) vehicles = vehicles.slice(0, limit);

  const specsMaster = loadJson<{ veiculos: Record<string, Record<string, unknown>> }>(PATHS.specsMaster).veiculos;
  const engineGraph = loadJson<{ veiculos: Record<string, { engine_id: string }> }>(PATHS.engineGraph).veiculos;
  const engineMaster = loadJson<{ entities?: Record<string, Record<string, unknown>> }>(PATHS.engineMaster).entities ?? {};

  const registry = new SourceRegistry();
  registry.loadPbev();

  const conflicts: ConflictRow[] = [];
  let withBundleConsumo = 0;
  let withPbev = 0;
  let familyMatches = 0;
  let provenanceInBundle = 0;

  for (const v of vehicles) {
    const bundleFile = path.join(
      PATHS.vehicleBundlesRoot,
      v.marcaSlug,
      `${v.id.replace(/[^a-z0-9-]/gi, '-')}.json`,
    );

    // page slug differs — scan marca folder
    const marcaDir = path.join(PATHS.vehicleBundlesRoot, v.marcaSlug);
    let bundle: Record<string, unknown> | null = null;
    if (fs.existsSync(marcaDir)) {
      for (const f of fs.readdirSync(marcaDir).filter((x) => x.endsWith('.json'))) {
        const raw = loadJson<Record<string, unknown>>(path.join(marcaDir, f));
        const identity = raw.identity as { vehicleId?: string } | undefined;
        if (identity?.vehicleId === v.id) {
          bundle = raw;
          break;
        }
      }
    }

    const pbevHit = matchInmetroForVehicleWithMeta(v.marca, v.modelo, registry.pbevIndex);
    const pbev = pbevHit?.record as {
      consumoCidade?: number;
      consumoCidadeEtanol?: number;
      matchKey?: string;
    } | null;
    const pbevCidade = num(pbev?.consumoCidade);

    if (pbevHit?.meta.tier === 'family_prefix') familyMatches++;

    const bundleInmetro = bundle?.inmetro as Record<string, unknown> | null;
    const bundleCidade = num(bundleInmetro?.consumoCidade);
    if (bundleCidade != null) withBundleConsumo++;
    if (pbevCidade != null) withPbev++;
    if (bundle?.provenance) provenanceInBundle++;

    const specRec = specsMaster[v.id];
    const specsCidade = num(specRec?.consumo_cidade ?? specRec?.consumoCidade);

    const eg = engineGraph[v.id];
    const engine = eg?.engine_id ? engineMaster[eg.engine_id] : null;
    const engineCidade = num(engine?.consumoCidade ?? engine?.consumo_cidade);

    const sources = [bundleCidade, pbevCidade, specsCidade, engineCidade].filter((x) => x != null) as number[];
    const unique = [...new Set(sources.map((x) => Math.round(x * 10) / 10))];

    if (unique.length > 1) {
      const ref = pbevCidade ?? bundleCidade ?? unique[0];
      const delta = ref != null && bundleCidade != null ? Math.abs(bundleCidade - ref) : null;
      const severity: ConflictRow['severity'] =
        delta != null && delta >= 1.5 ? 'critical' : delta != null && delta >= 0.5 ? 'warning' : 'info';

      let note = `Valores distintos: bundle=${bundleCidade}, pbev=${pbevCidade}, specs=${specsCidade}, engine=${engineCidade}`;
      if (pbev?.consumoCidadeEtanol === bundleCidade && pbevCidade !== bundleCidade) {
        note += ' — possível confusão gasolina/etanol';
      }
      if (pbevHit?.meta.tier === 'family_prefix') {
        note += ` — match por família (${pbevHit.meta.matchKey})`;
      }

      conflicts.push({
        vehicleId: v.id,
        displayName: `${v.marca} ${v.modelo} ${v.ano}`,
        bundleCidade,
        pbevCidade,
        specsCidade,
        engineCidade,
        bundleMatchTier: bundleInmetro?.matchTier as string | undefined,
        pbevMatchKey: pbevHit?.meta.matchKey,
        delta,
        severity,
        note,
      });
    }
  }

  conflicts.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));

  const reportDir = path.join(process.cwd(), 'data', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const outFile = path.join(reportDir, 'consumption-provenance-audit.json');
  const summary = {
    geradoEm: new Date().toISOString(),
    veiculosAnalisados: vehicles.length,
    comConsumoNoBundle: withBundleConsumo,
    comMatchPbev: withPbev,
    matchesPorFamilia: familyMatches,
    bundlesComProvenance: provenanceInBundle,
    conflitos: conflicts.length,
    criticos: conflicts.filter((c) => c.severity === 'critical').length,
    duracaoMs: Date.now() - started,
  };

  fs.writeFileSync(outFile, JSON.stringify({ summary, conflicts: conflicts.slice(0, 500) }, null, 2), 'utf-8');

  console.log('=== Auditoria de consumo e proveniência ===');
  console.log(`Veículos analisados: ${summary.veiculosAnalisados}`);
  console.log(`Com consumo no bundle: ${summary.comConsumoNoBundle}`);
  console.log(`Match PBEV: ${summary.comMatchPbev} (${summary.matchesPorFamilia} por família)`);
  console.log(`Bundles com provenance: ${summary.bundlesComProvenance}`);
  console.log(`Conflitos: ${summary.conflitos} (${summary.criticos} críticos)`);
  console.log(`Relatório: ${outFile}`);

  const sentra = conflicts.filter((c) => c.displayName.toLowerCase().includes('sentra'));
  if (sentra.length) {
    console.log('\n--- Nissan Sentra (amostra) ---');
    for (const row of sentra.slice(0, 10)) {
      console.log(
        `${row.displayName}: bundle=${row.bundleCidade} pbev=${row.pbevCidade} Δ=${row.delta} [${row.severity}] conf=${confidenceLabel(row.delta ? 70 : 95)}`,
      );
      console.log(`  ${row.note}`);
    }
  }

  const top = conflicts.filter((c) => c.severity === 'critical').slice(0, 8);
  if (top.length) {
    console.log('\n--- Top conflitos críticos ---');
    for (const row of top) {
      console.log(`${row.displayName}: ${row.note}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
