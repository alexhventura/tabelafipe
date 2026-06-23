import fs from "fs";
import path from "path";
import { PATHS } from "../lib/fipe-paths.js";
import { normalizeVehicle, normalizeText } from "../lib/enrichment/matching-engine.js";
import { loadGenerationsCatalog, sameGeneration } from "../lib/enrichment/generation-match.js";
import { marcaSlug } from "../lib/fipe-slug.js";
import type { ManufacturerRecord } from "../lib/enrichment/manufacturer-record.js";
import type { NormalizedVehicle } from "../lib/enrichment/types.js";

const MATCH_OEM_PAGE = 0.68;

function oemCatalogScore(fipe: { marca: string; modelo: string; ano: number }, row: ManufacturerRecord): number {
  if (marcaSlug(fipe.marca) !== marcaSlug(row.marca)) return 0;
  const fm = normalizeText(fipe.modelo);
  const rm = normalizeText(row.modelo);
  if (!rm || rm.length < 2) return 0;
  if (!fm.includes(rm) && !fm.startsWith(rm.split(" ")[0] ?? "")) return 0;
  const anoDiff = row.ano ? Math.abs(fipe.ano - row.ano) : 0;
  if (anoDiff > 3) return 0;
  return Math.min(0.95, MATCH_OEM_PAGE + (anoDiff === 0 ? 0.12 : anoDiff === 1 ? 0.08 : 0.04));
}

function loadVehicles(): NormalizedVehicle[] {
  return (JSON.parse(fs.readFileSync(PATHS.normalizedVeiculos, "utf8")) as NormalizedVehicle[]).map((v) => normalizeVehicle(v));
}

function loadManufacturerSeeds(): ManufacturerRecord[] {
  const rows: ManufacturerRecord[] = [];
  if (!fs.existsSync(PATHS.rawManufacturers)) return rows;
  for (const f of fs.readdirSync(PATHS.rawManufacturers).filter((x) => x.endsWith(".json") && x !== "crawl-log.json")) {
    const parsed = JSON.parse(fs.readFileSync(path.join(PATHS.rawManufacturers, f), "utf8"));
    if (Array.isArray(parsed)) rows.push(...parsed);
  }
  return rows;
}

function familyKey(v: NormalizedVehicle): string { return v.marcaSlug + "|" + (v.modeloSlug.split("-")[0] ?? v.modeloSlug); }

function main() {
  const vehicles = loadVehicles();
  const seeds = loadManufacturerSeeds();
  const genCatalog = loadGenerationsCatalog();
  const byFamily = new Map<string, NormalizedVehicle[]>();
  for (const v of vehicles) (byFamily.get(familyKey(v)) ?? byFamily.set(familyKey(v), []).get(familyKey(v))!).push(v);
  const report = [] as Array<Record<string, unknown>>;
  for (const seed of seeds) {
    const direct = vehicles.filter((v) => oemCatalogScore({ marca: v.marca, modelo: v.modelo, ano: v.ano }, seed) >= MATCH_OEM_PAGE);
    const anchor = direct[0];
    let propagated = 0;
    if (anchor) {
      const peers = byFamily.get(familyKey(anchor)) ?? [];
      for (const p of peers) {
        if (p.vehicleId === anchor.vehicleId) continue;
        if (sameGeneration(p.marca, p.modeloSlug, p.ano, anchor.ano, genCatalog)) propagated++;
      }
    }
    const impacto = direct.length + propagated;
    report.push({ seed_id: seed.adapterId + ":" + seed.modelo + ":" + (seed.ano ?? ""), marca: seed.marca, modelo: seed.modelo, ano: seed.ano, matches_diretos: direct.length, propagacao_estimada: propagated, impacto_estimado: impacto, url: seed.urlFonte });
  }
  report.sort((a, b) => (b.impacto_estimado as number) - (a.impacto_estimado as number));
  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  const out = { geradoEm: new Date().toISOString(), total_oem_seeds: report.length, meta_curto_prazo: 5000, seeds: report };
  fs.writeFileSync(PATHS.seedImpactReport, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ total_oem_seeds: report.length, top: report.slice(0, 10).map((r) => r.seed_id) }, null, 2));
}

main();
