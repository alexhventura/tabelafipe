import fs from "fs";
import { PATHS } from "../lib/fipe-paths.js";
import { marcaSlug } from "../lib/fipe-slug.js";
import { normalizeVehicle } from "../lib/enrichment/matching-engine.js";
import type { NormalizedVehicle } from "../lib/enrichment/types.js";

interface TransmissionDef { id: string; nome: string; modeloPatterns: string[]; marcas: string[]; }
function norm(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function matchTransmission(v: NormalizedVehicle, defs: TransmissionDef[]): string | undefined {
  const modelo = norm(v.modeloSlug + " " + v.modelo);
  const marca = marcaSlug(v.marca);
  for (const t of defs) {
    const marcaOk = t.marcas.some((m) => marcaSlug(m) === marca || norm(m) === marca);
    if (!marcaOk) continue;
    if (t.modeloPatterns.some((p) => modelo.includes(norm(p)))) return t.id;
  }
  return undefined;
}
async function main() {
  const catalog = JSON.parse(fs.readFileSync(PATHS.transmissionsCatalog, "utf8")) as { transmissions: TransmissionDef[] };
  const input = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const vehicles = (JSON.parse(fs.readFileSync(input, "utf8")) as NormalizedVehicle[]).map((e) => normalizeVehicle(e));
  const veiculos: Record<string, { vehicle_id: string; transmission_id: string; transmission_nome: string; propagation_hint: string }> = {};
  const counts = new Map<string, number>();
  for (const v of vehicles) {
    const tid = matchTransmission(v, catalog.transmissions);
    if (!tid) continue;
    const tr = catalog.transmissions.find((t) => t.id === tid)!;
    veiculos[v.vehicleId] = { vehicle_id: v.vehicleId, transmission_id: tid, transmission_nome: tr.nome, propagation_hint: "same_transmission_family" };
    counts.set(tid, (counts.get(tid) ?? 0) + 1);
  }
  const out = { geradoEm: new Date().toISOString(), transmissions: catalog.transmissions.map((t) => ({ id: t.id, nome: t.nome, veiculos: counts.get(t.id) ?? 0 })), totalVeiculosComTransmissao: Object.keys(veiculos).length, veiculos };
  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(PATHS.transmissionGraph, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ transmissions: catalog.transmissions.length, veiculos: out.totalVeiculosComTransmissao }));
}
main().catch((e) => { console.error(e); process.exit(1); });