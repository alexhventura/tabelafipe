import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';
import { normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';
import type { SpecMasterRecord } from './build-specs-master.js';

const FIELDS: { key: keyof SpecMasterRecord; label: string }[] = [
  { key: 'potencia', label: 'potencia' },
  { key: 'torque', label: 'torque' },
  { key: 'transmissao', label: 'transmissao' },
  { key: 'porta_malas', label: 'porta_malas' },
  { key: 'tanque', label: 'tanque' },
  { key: 'peso', label: 'peso' },
  { key: 'comprimento', label: 'comprimento' },
  { key: 'largura', label: 'largura' },
  { key: 'altura', label: 'altura' },
  { key: 'entre_eixos', label: 'entre_eixos' },
  { key: 'aceleracao0a100', label: 'aceleracao0a100' },
  { key: 'velocidade_max', label: 'velocidade_max' },
  { key: 'bateria_kwh', label: 'bateria_kwh' },
  { key: 'autonomia_km', label: 'autonomia_km' },
  { key: 'geracao_id', label: 'geracao_id' },
];

function familyKey(v: NormalizedVehicle): string {
  return `${v.marcaSlug}|${v.modeloSlug.split('-')[0] ?? v.modeloSlug}`;
}

function loadVehicles(): NormalizedVehicle[] {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  return (JSON.parse(fs.readFileSync(file, 'utf-8')) as NormalizedVehicle[]).map((v) => normalizeVehicle(v));
}

function loadSpecs(): Map<string, SpecMasterRecord> {
  if (!fs.existsSync(PATHS.specsMaster)) return new Map();
  const data = JSON.parse(fs.readFileSync(PATHS.specsMaster, 'utf-8')) as {
    veiculos: Record<string, SpecMasterRecord>;
  };
  return new Map(Object.entries(data.veiculos ?? {}));
}

function coverageFor(
  vehicleIds: string[],
  specs: Map<string, SpecMasterRecord>,
  key: keyof SpecMasterRecord,
): number {
  if (!vehicleIds.length) return 0;
  let hit = 0;
  for (const id of vehicleIds) {
    const s = specs.get(id);
    if (s && s[key] != null && s[key] !== '') hit++;
  }
  return hit / vehicleIds.length;
}

async function main() {
  const vehicles = loadVehicles();
  const specs = loadSpecs();
  const byFamily = new Map<string, string[]>();

  for (const v of vehicles) {
    const fk = familyKey(v);
    (byFamily.get(fk) ?? byFamily.set(fk, []).get(fk)!).push(v.vehicleId);
  }

  const rankedFamilies = [...byFamily.entries()]
    .map(([fk, ids]) => ({ fk, count: ids.length, ids }))
    .sort((a, b) => b.count - a.count);
  const topFamilies = rankedFamilies.slice(0, 1000);
  const topIds = new Set(topFamilies.flatMap((f) => f.ids));
  const allIds = vehicles.map((v) => v.vehicleId);

  const ranking = FIELDS.map(({ key, label }) => {
    const globalPct = coverageFor(allIds, specs, key);
    const topPct = coverageFor([...topIds], specs, key);
    return { field: label, global_pct: Math.round(globalPct * 10000) / 100, top1000_families_pct: Math.round(topPct * 10000) / 100 };
  }).sort((a, b) => b.global_pct - a.global_pct);

  const report = {
    geradoEm: new Date().toISOString(),
    totalVeiculos: allIds.length,
    familias: byFamily.size,
    topFamilias: topFamilies.length,
    fields: ranking,
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.coverageRankingReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ top: ranking.slice(0, 8) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});