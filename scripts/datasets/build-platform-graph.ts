import fs from "fs";
import { PATHS } from "../lib/fipe-paths.js";
import { marcaSlug } from "../lib/fipe-slug.js";
import { baseModelSlug } from "../lib/enrichment/generation-match.js";
import { normalizeVehicle } from "../lib/enrichment/matching-engine.js";
import type { NormalizedVehicle } from "../lib/enrichment/types.js";

interface PlatformDef {
  id: string;
  nome: string;
  fabricante: string;
  familias: Array<{ marca: string; modeloFamilia: string }>;
}

function familyKey(marca: string, modeloSlug: string): string {
  return marcaSlug(marca) + "|" + baseModelSlug(modeloSlug);
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(PATHS.platformsCatalog, "utf8")) as { plataformas: PlatformDef[] };
  const input = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const vehicles = (JSON.parse(fs.readFileSync(input, "utf8")) as NormalizedVehicle[]).map((v) => normalizeVehicle(v));

  const familiaToPlatform = new Map<string, string>();
  for (const p of catalog.plataformas) {
    for (const f of p.familias) {
      familiaToPlatform.set(marcaSlug(f.marca) + "|" + f.modeloFamilia.toLowerCase(), p.id);
    }
  }

  const veiculos: Record<string, { vehicle_id: string; platform_id: string; platform_nome: string }> = {};
  const platformCounts = new Map<string, number>();

  for (const v of vehicles) {
    const key = familyKey(v.marca, v.modeloSlug);
    const pid = familiaToPlatform.get(key);
    if (!pid) continue;
    const plat = catalog.plataformas.find((p) => p.id === pid)!;
    veiculos[v.vehicleId] = { vehicle_id: v.vehicleId, platform_id: pid, platform_nome: plat.nome };
    platformCounts.set(pid, (platformCounts.get(pid) ?? 0) + 1);
  }

  const out = {
    geradoEm: new Date().toISOString(),
    plataformas: catalog.plataformas.map((p) => ({ ...p, veiculos: platformCounts.get(p.id) ?? 0 })),
    totalVeiculosComPlataforma: Object.keys(veiculos).length,
    veiculos,
  };

  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(PATHS.platformGraph, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ plataformas: catalog.plataformas.length, veiculos: out.totalVeiculosComPlataforma }));
}

main().catch((e) => { console.error(e); process.exit(1); });
