/**
 * enrich:build — gera JSON final em data/generated/ para consumo das paginas.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { VehicleEnrichmentEngine } from '../lib/enrichment/vehicle-enrichment-engine.js';
import type { EnrichedVehicle, GeneratedVehicle, PipelineReport } from '../lib/enrichment/types.js';

function parseLimit(): number {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? parseInt(process.argv[i + 1], 10) || 0 : 0;
}

async function main() {
  const enrichedDir = PATHS.enrichedRoot;
  if (!fs.existsSync(enrichedDir)) {
    console.error('Camada enriched ausente. Execute: npm run enrich:vehicles');
    process.exit(1);
  }

  const files = fs.readdirSync(enrichedDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
  const limit = parseLimit();
  const slice = limit > 0 ? files.slice(0, limit) : files;

  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  const engine = new VehicleEnrichmentEngine([]);

  let comInmetro = 0;
  let comHistorico = 0;
  let comSpecs = 0;

  for (const f of slice) {
    const enriched = JSON.parse(fs.readFileSync(path.join(enrichedDir, f), 'utf-8')) as EnrichedVehicle;
    const generated: GeneratedVehicle = engine.toGenerated(enriched);
    if (generated.inmetro) comInmetro++;
    if (generated.vehicle.historicoPrecos.length > 1) comHistorico++;
    if (generated.specs) comSpecs++;
    fs.writeFileSync(path.join(PATHS.generatedRoot, f), JSON.stringify(generated));
  }

  const report: PipelineReport = {
    geradoEm: new Date().toISOString(),
    camadas: {
      raw: { fontesPresentes: 0, fontesTotal: 4 },
      normalized: { veiculos: slice.length, matchKeys: 0 },
      enriched: { veiculos: slice.length, comInmetro, comHistorico, comSpecs },
      generated: { veiculos: slice.length },
    },
    cobertura: {
      inmetroPct: Math.round((comInmetro / slice.length) * 10000) / 100,
      historicoPct: Math.round((comHistorico / slice.length) * 10000) / 100,
      specsPct: Math.round((comSpecs / slice.length) * 10000) / 100,
      derivedPct: 100,
    },
  };

  if (fs.existsSync(PATHS.rawManifest)) {
    const raw = JSON.parse(fs.readFileSync(PATHS.rawManifest, 'utf-8')) as { fontes: { presente: boolean }[] };
    report.camadas.raw.fontesPresentes = raw.fontes.filter((x) => x.presente).length;
    report.camadas.raw.fontesTotal = raw.fontes.length;
  }

  fs.writeFileSync(PATHS.generatedManifest, JSON.stringify({ geradoEm: report.geradoEm, total: slice.length }, null, 2));
  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.enrichmentPipelineReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });