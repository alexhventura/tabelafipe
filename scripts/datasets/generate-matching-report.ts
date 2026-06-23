import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';
import { buildMatchIndex, findMatchCollisions, normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import { buildVehicleUid } from '../lib/enrichment/vehicle-uid.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

async function main() {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const vehicles = JSON.parse(fs.readFileSync(file, 'utf-8')).map((v: NormalizedVehicle) => (v.vehicleId ? v : normalizeVehicle(v)));
  const collisions = findMatchCollisions(buildMatchIndex(vehicles));
  const uidMap = new Map<string, string[]>();
  for (const v of vehicles) {
    const uid = v.vehicleUid ?? buildVehicleUid(v.marca, v.modelo, v.ano, v.combustivel, v.versaoNormalizada);
    const list = uidMap.get(uid) ?? [];
    list.push(v.vehicleId);
    uidMap.set(uid, list);
  }
  const report = { geradoEm: new Date().toISOString(), totalVeiculos: vehicles.length, colisoesMatchKey: collisions.length, colisoesUid: [...uidMap.values()].filter(ids => new Set(ids).size > 1).length, amostraColisoes: collisions.slice(0, 15) };
  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.matchingReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });