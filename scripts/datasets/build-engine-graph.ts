import fs from "fs";
import { PATHS } from "../lib/fipe-paths.js";
import { marcaSlug } from "../lib/fipe-slug.js";
import { normalizeVehicle } from "../lib/enrichment/matching-engine.js";
import type { NormalizedVehicle } from "../lib/enrichment/types.js";

interface EngineDef { id: string; nome: string; modeloPatterns: string[]; marcas: string[]; }
function norm(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function matchEngine(v: NormalizedVehicle, engines: EngineDef[]): string | undefined {
  const modelo = norm(v.modeloSlug + " " + v.modelo);
  const marca = marcaSlug(v.marca);
  for (const e of engines) {
    const marcaOk = e.marcas.some((m) => marcaSlug(m) === marca || norm(m) === marca);
    if (!marcaOk) continue;
    if (e.modeloPatterns.some((p) => modelo.includes(norm(p)))) return e.id;
  }
  return undefined;
}
async function main() {
  const catalog = JSON.parse(fs.readFileSync(PATHS.enginesCatalog, "utf8")) as { engines: EngineDef[] };
  const input = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const vehicles = (JSON.parse(fs.readFileSync(input, "utf8")) as NormalizedVehicle[]).map((e) => normalizeVehicle(e));
  const veiculos: Record<string, { vehicle_id: string; engine_id: string; engine_nome: string; propagation_hint: string }> = {};
  const counts = new Map<string, number>();
  for (const v of vehicles) {
    const engineId = matchEngine(v, catalog.engines);
    if (!engineId) continue;
    const eng = catalog.engines.find((e) => e.id === engineId)!;
    veiculos[v.vehicleId] = { vehicle_id: v.vehicleId, engine_id: engineId, engine_nome: eng.nome, propagation_hint: "same_engine_family" };
    counts.set(engineId, (counts.get(engineId) ?? 0) + 1);
  }
  const out = { geradoEm: new Date().toISOString(), engines: catalog.engines.map((e) => ({ id: e.id, nome: e.nome, veiculos: counts.get(e.id) ?? 0 })), totalVeiculosComMotor: Object.keys(veiculos).length, veiculos };
  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(PATHS.engineGraph, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ engines: catalog.engines.length, veiculos: out.totalVeiculosComMotor }));
}
main().catch((e) => { console.error(e); process.exit(1); });