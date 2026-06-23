import fs from "fs";
import { PATHS } from "../lib/fipe-paths.js";
import { buildAllFamilies } from "../lib/catalog-index.js";
import { marcaSlug } from "../lib/fipe-slug.js";

type SeedSpecs = {
  potencia?: number;
  torqueNm?: number;
  oleo?: string;
  capacidadeOleoL?: number;
  cambio?: string;
  fonte?: string;
  source_rank?: number;
};

type EngineDef = {
  id: string;
  nome: string;
  modeloPatterns: string[];
  marcas: string[];
  seedSpecs?: SeedSpecs;
};

type PdfRecord = {
  marca: string;
  modelo: string;
  potenciaCv?: number;
  torqueNm?: number;
  cambio?: string;
  fonte?: string;
  urlFonte?: string;
  capturadoEm?: string;
};

type MaintRec = {
  oleoRecomendado?: string;
  capacidadeOleoL?: number;
  fonte?: string;
};

type TruthSlice = {
  potencia?: number;
  torque?: number;
  torqueNm?: number;
  oleo?: string;
  capacidadeOleoL?: number;
  cambio?: string;
  fonte: string;
  source_rank: number;
  captured_at: string;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchEngineId(marca: string, modelo: string, engines: EngineDef[]): string | undefined {
  const mSlug = marcaSlug(marca);
  const mod = norm(modelo);
  for (const e of engines) {
    const marcaOk = e.marcas.some((m) => marcaSlug(m) === mSlug || norm(m) === mSlug);
    if (!marcaOk) continue;
    if (e.modeloPatterns.some((p) => mod.includes(norm(p)))) return e.id;
  }
  return undefined;
}

function familiaKeysForEngine(engine: EngineDef, familias: ReturnType<typeof buildAllFamilies>): string[] {
  const keys: string[] = [];
  for (const f of familias) {
    const mod = norm(f.modeloFamilia);
    const marcaOk = engine.marcas.some((m) => marcaSlug(m) === marcaSlug(f.marca));
    if (!marcaOk) continue;
    if (engine.modeloPatterns.some((p) => mod.includes(norm(p)))) keys.push(f.familiaKey);
  }
  return [...new Set(keys)];
}

function pickBest(a: TruthSlice | undefined, b: TruthSlice): TruthSlice {
  if (!a) return b;
  return (b.source_rank ?? 0) >= (a.source_rank ?? 0) ? b : a;
}

function fromSeed(seed: SeedSpecs, engineId: string): TruthSlice {
  return {
    potencia: seed.potencia,
    torque: seed.torqueNm,
    torqueNm: seed.torqueNm,
    oleo: seed.oleo,
    capacidadeOleoL: seed.capacidadeOleoL,
    cambio: seed.cambio,
    fonte: seed.fonte ?? `engines-catalog:${engineId}`,
    source_rank: seed.source_rank ?? 90,
    captured_at: new Date().toISOString(),
  };
}

function fromPdf(r: PdfRecord): TruthSlice {
  return {
    potencia: r.potenciaCv,
    torque: r.torqueNm,
    torqueNm: r.torqueNm,
    cambio: r.cambio,
    fonte: r.urlFonte ?? r.fonte ?? "parsed-pdf",
    source_rank: 85,
    captured_at: r.capturadoEm ?? new Date().toISOString(),
  };
}

function fromMaint(r: MaintRec): TruthSlice {
  return {
    oleo: r.oleoRecomendado,
    capacidadeOleoL: r.capacidadeOleoL,
    fonte: r.fonte ?? "maintenance-specs",
    source_rank: 72,
    captured_at: new Date().toISOString(),
  };
}

function confidenceFromRank(rank: number, fields: number): number {
  const base = Math.min(0.98, rank / 100);
  return Math.round((base + fields * 0.02) * 100) / 100;
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(PATHS.enginesCatalog, "utf8")) as { engines: EngineDef[] };
  const engines = catalog.engines;
  const familias = buildAllFamilies();

  const graph = fs.existsSync(PATHS.engineGraph)
    ? (JSON.parse(fs.readFileSync(PATHS.engineGraph, "utf8")) as { engines?: Array<{ id: string; veiculos?: number }> })
    : { engines: [] };
  const vehByEngine = new Map((graph.engines ?? []).map((e) => [e.id, e.veiculos ?? 0]));

  const pdfRecords: PdfRecord[] = [];
  if (fs.existsSync(PATHS.rawCatalogsParsed)) {
    const parsed = JSON.parse(fs.readFileSync(PATHS.rawCatalogsParsed, "utf8")) as { records?: PdfRecord[] };
    pdfRecords.push(...(parsed.records ?? []));
  }

  const maintByEngine = new Map<string, MaintRec[]>();
  if (fs.existsSync(PATHS.maintenanceSpecs)) {
    const ms = JSON.parse(fs.readFileSync(PATHS.maintenanceSpecs, "utf8")) as {
      registros?: Record<string, MaintRec & { marca: string; modelo: string }>;
    };
    for (const rec of Object.values(ms.registros ?? {})) {
      const eid = matchEngineId(rec.marca, rec.modelo, engines);
      if (!eid) continue;
      const arr = maintByEngine.get(eid) ?? [];
      arr.push(rec);
      maintByEngine.set(eid, arr);
    }
  }

  const entities = engines.map((engine) => {
    let truth: TruthSlice | undefined;
    if (engine.seedSpecs) truth = pickBest(truth, fromSeed(engine.seedSpecs, engine.id));

    for (const rec of pdfRecords) {
      if (matchEngineId(rec.marca, rec.modelo, engines) !== engine.id) continue;
      truth = pickBest(truth, fromPdf(rec));
    }

    for (const rec of maintByEngine.get(engine.id) ?? []) {
      truth = pickBest(truth, fromMaint(rec));
    }

    const famKeys = familiaKeysForEngine(engine, familias);
    const fieldCount = [truth?.potencia, truth?.torqueNm, truth?.oleo, truth?.capacidadeOleoL, truth?.cambio].filter(
      (x) => x != null,
    ).length;

    return {
      id: engine.id,
      entity: "engine",
      potencia: truth?.potencia,
      torque: truth?.torque,
      torqueNm: truth?.torqueNm,
      oleo: truth?.oleo,
      capacidadeOleoL: truth?.capacidadeOleoL,
      cambio: truth?.cambio,
      fonte: truth?.fonte ?? "none",
      source_rank: truth?.source_rank ?? 0,
      captured_at: truth?.captured_at ?? new Date().toISOString(),
      familias: famKeys,
      veiculos_estimados: vehByEngine.get(engine.id) ?? 0,
      confidence: truth ? confidenceFromRank(truth.source_rank, fieldCount) : 0,
    };
  });

  const out = {
    geradoEm: new Date().toISOString(),
    observacao: "Technical truth master por motor",
    total: entities.length,
    entities,
  };

  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(PATHS.engineMaster, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ total: entities.length, comTruth: entities.filter((e) => e.source_rank > 0).length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});