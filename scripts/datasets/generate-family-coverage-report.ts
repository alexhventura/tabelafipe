import fs from "fs";
import { PATHS } from "../lib/fipe-paths.js";
import { normalizeVehicle } from "../lib/enrichment/matching-engine.js";
import { marcaSlug } from "../lib/fipe-slug.js";
import { baseModelSlug } from "../lib/enrichment/generation-match.js";
import type { NormalizedVehicle } from "../lib/enrichment/types.js";

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 10000) / 100 : 0;
}

async function main() {
  const input = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const vehicles = (JSON.parse(fs.readFileSync(input, "utf8")) as NormalizedVehicle[]).map((v) => normalizeVehicle(v));
  const master = fs.existsSync(PATHS.specsMaster)
    ? (JSON.parse(fs.readFileSync(PATHS.specsMaster, "utf8")) as { veiculos: Record<string, Record<string, unknown>> }).veiculos
    : {};

  const families = new Map<string, { marca: string; familia: string; label: string; total: number; potencia: number; torque: number; porta_malas: number }>();

  for (const v of vehicles) {
    const familia = baseModelSlug(v.modeloSlug);
    const key = marcaSlug(v.marca) + "|" + familia;
    const label = v.marca + " " + familia.charAt(0).toUpperCase() + familia.slice(1);
    const f = families.get(key) ?? { marca: v.marca, familia, label, total: 0, potencia: 0, torque: 0, porta_malas: 0 };
    f.total++;
    const s = master[v.vehicleId];
    if (s?.potencia != null) f.potencia++;
    if (s?.torque != null) f.torque++;
    if (s?.porta_malas != null) f.porta_malas++;
    families.set(key, f);
  }

  const rows = [...families.values()]
    .map((f) => ({
      familia: f.label,
      familiaKey: marcaSlug(f.marca) + "|" + f.familia,
      totalVeiculos: f.total,
      potencia_pct: pct(f.potencia, f.total),
      torque_pct: pct(f.torque, f.total),
      porta_malas_pct: pct(f.porta_malas, f.total),
    }))
    .sort((a, b) => b.totalVeiculos - a.totalVeiculos);

  const report = {
    geradoEm: new Date().toISOString(),
    totalFamilias: rows.length,
    topComCobertura: rows.filter((r) => r.potencia_pct >= 50).slice(0, 30),
    maioresGaps: rows.filter((r) => r.totalVeiculos >= 20 && r.potencia_pct < 10).slice(0, 30),
    familias: rows,
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.familyCoverageReport, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ familias: rows.length, top5: rows.slice(0, 5) }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
