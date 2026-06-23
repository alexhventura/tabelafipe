/**
 * enrich:normalize — padroniza veiculos FIPE e cria vehicle_id + match keys.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { buildMatchIndex, findMatchCollisions, normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import type { FipeVehicle } from '../lib/enrichment/types.js';

async function main() {
  const input = process.argv.includes('--input')
    ? process.argv[process.argv.indexOf('--input') + 1]
    : PATHS.srcVeiculos;

  if (!fs.existsSync(input)) {
    console.error('Catalogo nao encontrado:', input);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(input, 'utf-8')) as FipeVehicle[];
  const normalized = raw.map(normalizeVehicle);
  const matchIndex = buildMatchIndex(normalized);
  const collisions = findMatchCollisions(matchIndex);

  fs.mkdirSync(PATHS.normalizedRoot, { recursive: true });
  fs.writeFileSync(PATHS.normalizedVeiculos, JSON.stringify(normalized));
  fs.writeFileSync(
    PATHS.normalizedMatchIndex,
    JSON.stringify(Object.fromEntries(matchIndex), null, 2),
  );

  const { spawnSync } = await import('child_process');
  spawnSync('npx', ['tsx', 'scripts/datasets/generate-matching-report.ts'], { stdio: 'inherit', shell: true });

  console.log(JSON.stringify({
    input,
    veiculos: normalized.length,
    matchKeys: matchIndex.size,
    colisoes: collisions.length,
    amostraColisoes: collisions.slice(0, 5),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });