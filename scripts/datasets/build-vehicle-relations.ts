import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';
import { normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import { loadGenerationsCatalog, resolveGeneration } from '../lib/enrichment/generation-match.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

function familyKey(v: NormalizedVehicle): string {
  return `${v.marcaSlug}|${v.modeloSlug.split('-')[0] ?? v.modeloSlug}`;
}

function loadVehicles(): NormalizedVehicle[] {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  return (JSON.parse(fs.readFileSync(file, 'utf-8')) as NormalizedVehicle[]).map((v) => normalizeVehicle(v));
}

async function main() {
  const vehicles = loadVehicles();
  const genCatalog = loadGenerationsCatalog();
  const byFamily = new Map<string, NormalizedVehicle[]>();

  for (const v of vehicles) {
    (byFamily.get(familyKey(v)) ?? byFamily.set(familyKey(v), []).get(familyKey(v))!).push(v);
  }

  const relations: Record<
    string,
    { familia: string; geracao_id: string | null; mesma_familia: string[]; mesma_geracao: string[] }
  > = {};

  for (const v of vehicles) {
    const fam = familyKey(v);
    const peers = byFamily.get(fam) ?? [];
    const gen = resolveGeneration(v.marca, v.modeloSlug, v.ano, genCatalog)?.id ?? null;
    const mesmaFamilia = peers.filter((p) => p.vehicleId !== v.vehicleId).map((p) => p.vehicleId);
    const mesmaGeracao = peers
      .filter((p) => p.vehicleId !== v.vehicleId && resolveGeneration(p.marca, p.modeloSlug, p.ano, genCatalog)?.id === gen)
      .map((p) => p.vehicleId);

    relations[v.vehicleId] = {
      familia: fam,
      geracao_id: gen,
      mesma_familia: mesmaFamilia.slice(0, 50),
      mesma_geracao: mesmaGeracao.slice(0, 50),
    };
  }

  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(
    PATHS.vehicleRelations,
    JSON.stringify({ geradoEm: new Date().toISOString(), total: vehicles.length, relations }, null, 2),
  );
  console.log(JSON.stringify({ total: vehicles.length, familias: byFamily.size }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});