import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';
import { normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

type FieldStats = { preenchidos: number; pct: number; meta: number; atingiu: boolean };

function pct(n: number, total: number) { return Math.round((n / total) * 10000) / 100; }
function fieldStats(n: number, total: number, meta: number): FieldStats {
  const p = pct(n, total);
  return { preenchidos: n, pct: p, meta, atingiu: p >= meta };
}

async function main() {
  const input = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const vehicles = (JSON.parse(fs.readFileSync(input, 'utf-8')) as NormalizedVehicle[]).map((v) => normalizeVehicle(v));
  const master = fs.existsSync(PATHS.specsMaster)
    ? (JSON.parse(fs.readFileSync(PATHS.specsMaster, 'utf-8')) as { veiculos: Record<string, Record<string, unknown>> }).veiculos
    : {};
  const total = vehicles.length;
  let p = 0, t = 0, tr = 0, pm = 0;
  const byMarca = new Map();
  for (const v of vehicles) {
    const s = master[v.vehicleId];
    const m = byMarca.get(v.marca) ?? { total: 0, p: 0, t: 0, tr: 0, pm: 0 };
    m.total++;
    if (s?.potencia) { p++; m.p++; }
    if (s?.torque) { t++; m.t++; }
    if (s?.transmissao) { tr++; m.tr++; }
    if (s?.porta_malas) { pm++; m.pm++; }
    byMarca.set(v.marca, m);
  }
  const cobertura = { potencia: fieldStats(p, total, 70), torque: fieldStats(t, total, 70), transmissao: fieldStats(tr, total, 70), porta_malas: fieldStats(pm, total, 50) };
  const report = { geradoEm: new Date().toISOString(), totalVeiculos: total, cobertura, marcas: byMarca.size };
  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.specCoverageReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cobertura, marcas: byMarca.size }));
}
main().catch((e) => { console.error(e); process.exit(1); });
