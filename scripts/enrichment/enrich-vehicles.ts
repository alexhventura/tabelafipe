/**
 * enrich:vehicles — executa VehicleEnrichmentEngine e grava camada enriched/.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { VehicleEnrichmentEngine } from '../lib/enrichment/vehicle-enrichment-engine.js';
import { SourceRegistry } from '../lib/enrichment/source-loaders.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

function parseLimit(): number {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? parseInt(process.argv[i + 1], 10) || 0 : 0;
}

async function main() {
  const input = fs.existsSync(PATHS.normalizedVeiculos)
    ? PATHS.normalizedVeiculos
    : PATHS.srcVeiculos;

  let vehicles = JSON.parse(fs.readFileSync(input, 'utf-8')) as NormalizedVehicle[];
  const limit = parseLimit();
  if (limit > 0) vehicles = vehicles.slice(0, limit);

  const registry = new SourceRegistry();
  const pbevN = registry.loadPbev();
  const staticN = registry.loadStaticSpecs();
  const mfrN = registry.loadManufacturers();
  const safetyN = registry.loadSafety();
  const recallsN = registry.loadRecalls();
  const warrantyN = registry.loadWarranty();
  const mktN = registry.loadMarketplace();
  const histN = registry.loadHistory(PATHS.historyRoot, limit > 0 ? limit : 0);

  const engine = new VehicleEnrichmentEngine(vehicles, registry);
  fs.mkdirSync(PATHS.enrichedRoot, { recursive: true });

  let comInmetro = 0;
  let comHistorico = 0;
  let comSpecs = 0;

  for (const v of vehicles) {
    const enriched = engine.enrichOne(v);
    if (enriched.inmetro) comInmetro++;
    if (enriched.historico.length > 1) comHistorico++;
    if (enriched.specs) comSpecs++;
    fs.writeFileSync(
      path.join(PATHS.enrichedRoot, `${v.vehicleId ?? v.id}.json`),
      JSON.stringify(enriched),
    );
  }

  const manifest = {
    geradoEm: new Date().toISOString(),
    total: vehicles.length,
    fontes: { pbev: pbevN, staticSpecs: staticN, manufacturers: mfrN, safety: safetyN, recalls: recallsN, warranty: warrantyN, marketplace: mktN, history: histN },
    cobertura: { inmetro: comInmetro, historico: comHistorico, specs: comSpecs },
  };
  fs.writeFileSync(PATHS.enrichedManifest, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });