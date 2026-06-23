import fs from "fs";
import crypto from "crypto";
import { PATHS } from "../lib/fipe-paths.js";
import { marcaSlug } from "../lib/fipe-slug.js";
import { buildAllFamilies } from "../lib/catalog-index.js";

type EngineDef = { id: string; modeloPatterns: string[]; marcas: string[] };

type MaintRec = {
  marca: string;
  modelo: string;
  oleoRecomendado?: string;
  capacidadeOleoL?: number;
  bateriaAh?: number;
  pneusMedida?: string;
  velas?: string;
  fluidoArrefecimento?: string;
  fluidoFreio?: string;
  fonte: string;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchEngineId(marca: string, modelo: string, engines: EngineDef[]): string | undefined {
  const mSlug = marcaSlug(marca);
  const mod = norm(modelo);
  for (const e of engines) {
    const marcaOk = e.marcas.some((m) => marcaSlug(m) === mSlug);
    if (!marcaOk) continue;
    if (e.modeloPatterns.some((p) => mod.includes(norm(p)))) return e.id;
  }
  return undefined;
}

function signature(rec: MaintRec): string {
  const oleo = (rec.oleoRecomendado ?? "unknown").toLowerCase();
  const cap = rec.capacidadeOleoL != null ? String(rec.capacidadeOleoL) : "na";
  return oleo + "|" + cap;
}

async function main() {
  const engines = (
    JSON.parse(fs.readFileSync(PATHS.enginesCatalog, "utf8")) as { engines: EngineDef[] }
  ).engines;
  const familias = buildAllFamilies();

  const registros: MaintRec[] = [];
  if (fs.existsSync(PATHS.maintenanceSpecs)) {
    const ms = JSON.parse(fs.readFileSync(PATHS.maintenanceSpecs, "utf8")) as { registros?: Record<string, MaintRec> };
    registros.push(...Object.values(ms.registros ?? {}));
  }

  type Group = {
    oleo: string;
    capacidadeOleoL?: number;
    pneus: Set<string>;
    bateriaAh?: number;
    velas: Set<string>;
    fluidos: Set<string>;
    fontes: Set<string>;
    engineIds: Set<string>;
    familias: Set<string>;
  };

  const groups = new Map<string, Group>();

  for (const rec of registros) {
    const sig = signature(rec);
    const g =
      groups.get(sig) ??
      ({
        oleo: rec.oleoRecomendado ?? "nao-informado",
        capacidadeOleoL: rec.capacidadeOleoL,
        pneus: new Set<string>(),
        velas: new Set<string>(),
        fluidos: new Set<string>(),
        fontes: new Set<string>(),
        engineIds: new Set<string>(),
        familias: new Set<string>(),
      } as Group);
    if (rec.pneusMedida) g.pneus.add(rec.pneusMedida);
    if (rec.velas) g.velas.add(rec.velas);
    if (rec.bateriaAh) g.bateriaAh = rec.bateriaAh;
    if (rec.fluidoArrefecimento) g.fluidos.add(rec.fluidoArrefecimento);
    if (rec.fluidoFreio) g.fluidos.add(rec.fluidoFreio);
    g.fontes.add(rec.fonte);
    const eid = matchEngineId(rec.marca, rec.modelo, engines);
    if (eid) g.engineIds.add(eid);
    for (const f of familias) {
      if (marcaSlug(f.marca) !== marcaSlug(rec.marca)) continue;
      if (norm(f.modeloFamilia).includes(norm(rec.modelo)) || norm(rec.modelo).includes(norm(f.modeloFamilia))) {
        g.familias.add(f.familiaKey);
      }
    }
    groups.set(sig, g);
  }

  const entities = [...groups.entries()].map(([sig, g]) => ({
    id: crypto.createHash("sha1").update(sig).digest("hex").slice(0, 12),
    oleo: g.oleo,
    capacidadeOleoL: g.capacidadeOleoL,
    pneus: [...g.pneus],
    bateriaAh: g.bateriaAh,
    velas: [...g.velas],
    fluidos: [...g.fluidos],
    fonte: [...g.fontes].slice(0, 3).join("; "),
    engineIds: [...g.engineIds],
    familias: [...g.familias],
  }));

  const out = {
    geradoEm: new Date().toISOString(),
    total: entities.length,
    entities,
  };

  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(PATHS.maintenanceMaster, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ total: entities.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});