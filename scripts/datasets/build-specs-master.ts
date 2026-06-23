import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { normalizeVehicle, normalizeText } from '../lib/enrichment/matching-engine.js';
import { computeMatchingScore } from '../lib/enrichment/matching-score.js';
import { loadGenerationsCatalog, resolveGeneration } from '../lib/enrichment/generation-match.js';
import { inferSpecsFromFipeModel } from '../lib/enrichment/infer-fipe-specs.js';
import type { ManufacturerRecord } from '../lib/enrichment/manufacturer-record.js';
import {
  buildSeed,
  canPropagateSpec,
  propagationConfidence,
  shouldApplyPropagation,
  type PropagatableSpec,
} from '../lib/enrichment/spec-propagation.js';
import { marcaSlug } from '../lib/fipe-slug.js';
import { confidenceFromRank, rankFromMetodo } from '../lib/enrichment/source-rank.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

export interface SpecMasterRecord {
  vehicle_uid: string;
  vehicle_id: string;
  potencia?: number;
  torque?: number;
  transmissao?: string;
  porta_malas?: number;
  tanque?: number;
  peso?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  entre_eixos?: number;
  aceleracao0a100?: number;
  velocidade_max?: number;
  bateria_kwh?: number;
  autonomia_km?: number;
  confidence?: number;
  fonte: string;
  capturado_em: string;
  metodo?: string;
  geracao_id?: string;
  source_rank?: number;
  source_captured_at?: string;
}

type PS = Partial<
  Pick<
    SpecMasterRecord,
    | 'potencia'
    | 'torque'
    | 'transmissao'
    | 'porta_malas'
    | 'tanque'
    | 'peso'
    | 'comprimento'
    | 'largura'
    | 'altura'
    | 'entre_eixos'
    | 'aceleracao0a100'
    | 'velocidade_max'
    | 'bateria_kwh'
    | 'autonomia_km'
    | 'geracao_id'
  >
>;

const MATCH_OEM_PAGE = 0.68;

function oemCatalogScore(fipe: { marca: string; modelo: string; ano: number }, row: ManufacturerRecord): number {
  if (marcaSlug(fipe.marca) !== marcaSlug(row.marca)) return 0;
  const fm = normalizeText(fipe.modelo);
  const rm = normalizeText(row.modelo);
  if (!rm || rm.length < 2) return 0;
  if (!fm.includes(rm) && !fm.startsWith(rm.split(' ')[0] ?? '')) return 0;
  const anoDiff = row.ano ? Math.abs(fipe.ano - row.ano) : 0;
  if (anoDiff > 3) return 0;
  return Math.min(0.95, MATCH_OEM_PAGE + (anoDiff === 0 ? 0.12 : anoDiff === 1 ? 0.08 : 0.04));
}

function manufacturerScore(fipe: { marca: string; modelo: string; ano: number }, row: ManufacturerRecord): number {
  return Math.max(
    computeMatchingScore(fipe, { marca: row.marca, modelo: row.modelo, ano: row.ano }),
    oemCatalogScore(fipe, row),
  );
}

function loadVehicles(): NormalizedVehicle[] {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  return (JSON.parse(fs.readFileSync(file, 'utf-8')) as NormalizedVehicle[]).map((v) => normalizeVehicle(v));
}

function loadManufacturers(): ManufacturerRecord[] {
  const rows: ManufacturerRecord[] = [];
  if (!fs.existsSync(PATHS.rawManufacturers)) return rows;
  for (const f of fs.readdirSync(PATHS.rawManufacturers).filter((x) => x.endsWith('.json') && x !== 'crawl-log.json')) {
    const parsed = JSON.parse(fs.readFileSync(path.join(PATHS.rawManufacturers, f), 'utf-8'));
    if (Array.isArray(parsed)) rows.push(...parsed);
  }
  return rows;
}

function merge(a: PS, b: PS): PS {
  return { ...a, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v != null)) };
}

function fromMfr(r: ManufacturerRecord): PS {
  return {
    potencia: r.potenciaCv,
    torque: r.torqueNm,
    transmissao: r.cambio,
    porta_malas: r.portaMalasL,
    tanque: r.tanqueL,
    peso: r.pesoKg,
    comprimento: r.comprimentoMm,
    largura: r.larguraMm,
    altura: r.alturaMm,
    entre_eixos: r.entreEixosMm,
    aceleracao0a100: r.aceleracao0a100,
    velocidade_max: r.velocidadeMaxKmh,
    bateria_kwh: r.bateriaKwh,
    autonomia_km: r.autonomiaKm,
  };
}

function fromInfer(modelo: string): PS {
  const i = inferSpecsFromFipeModel(modelo);
  return {
    potencia: i.potenciaCv ?? undefined,
    torque: i.torqueNm ?? undefined,
    transmissao: i.cambio ?? undefined,
  };
}

function fromStatic(specs?: Record<string, unknown>): PS {
  if (!specs) return {};
  const pot = specs.potencia as { valor?: number } | undefined;
  const tor = specs.torque as { valor?: number } | undefined;
  const pm = specs.portaMalas as { valor?: number } | undefined;
  return {
    potencia: pot?.valor,
    torque: tor?.valor,
    transmissao: (specs.cambio as string | undefined) ?? undefined,
    porta_malas: pm?.valor,
    tanque: (specs.tanque as { valor?: number } | undefined)?.valor,
  };
}

function hasSpec(s: PS): boolean {
  return !!(
    s.potencia ||
    s.torque ||
    s.transmissao ||
    s.porta_malas ||
    s.peso ||
    s.comprimento ||
    s.bateria_kwh
  );
}

function toRec(v: NormalizedVehicle, s: PS, confidence: number, fonte: string, metodo: string, capturedAt?: string): SpecMasterRecord {
  return {
    vehicle_uid: v.vehicleUid ?? v.vehicleId,
    vehicle_id: v.vehicleId,
    ...s,
    fonte,
    capturado_em: capturedAt ?? new Date().toISOString(),
    metodo,
    source_rank: rankFromMetodo(metodo, fonte),
    source_captured_at: capturedAt ?? new Date().toISOString(),
    confidence: confidenceFromRank(rankFromMetodo(metodo, fonte), confidence),
  };
}

function familyKey(v: NormalizedVehicle): string {
  return v.marcaSlug + '|' + (v.modeloSlug.split('-')[0] ?? v.modeloSlug);
}


type EngineMasterEntity = {
  id: string;
  potencia?: number;
  torque?: number;
  torqueNm?: number;
  cambio?: string;
  fonte: string;
  source_rank: number;
  confidence: number;
  captured_at: string;
};

function loadEngineMaster(): Map<string, EngineMasterEntity> {
  const map = new Map<string, EngineMasterEntity>();
  if (!fs.existsSync(PATHS.engineMaster)) return map;
  const data = JSON.parse(fs.readFileSync(PATHS.engineMaster, 'utf-8')) as { entities?: EngineMasterEntity[] };
  for (const e of data.entities ?? []) {
    if ((e.source_rank ?? 0) > 0 && (e.confidence ?? 0) > 0) map.set(e.id, e);
  }
  return map;
}

function loadEngineGraphLinks(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(PATHS.engineGraph)) return map;
  const data = JSON.parse(fs.readFileSync(PATHS.engineGraph, 'utf-8')) as {
    veiculos?: Record<string, { vehicle_id: string; engine_id: string }>;
  };
  for (const link of Object.values(data.veiculos ?? {})) {
    map.set(link.vehicle_id, link.engine_id);
  }
  return map;
}

function fromEngineMaster(truth: EngineMasterEntity): PS {
  return {
    potencia: truth.potencia,
    torque: truth.torqueNm ?? truth.torque,
    transmissao: truth.cambio,
  };
}

function engineAddsFields(engineSpec: PS, ex?: SpecMasterRecord): boolean {
  if (!ex) return hasSpec(engineSpec);
  return (
    (engineSpec.potencia != null && ex.potencia == null) ||
    (engineSpec.torque != null && ex.torque == null) ||
    (engineSpec.transmissao != null && ex.transmissao == null)
  );
}

function toPropagatable(s: PS): PropagatableSpec {
  return { ...s };
}

async function main() {
  const vehicles = loadVehicles();
  const mfrRows = loadManufacturers();
  const staticCat = fs.existsSync(PATHS.staticSpecsCatalog)
    ? JSON.parse(fs.readFileSync(PATHS.staticSpecsCatalog, 'utf-8'))
    : {};
  const genCatalog = loadGenerationsCatalog();
  const master = new Map<string, SpecMasterRecord>();
  const byFamily = new Map<string, NormalizedVehicle[]>();

  for (const v of vehicles) {
    (byFamily.get(familyKey(v)) ?? byFamily.set(familyKey(v), []).get(familyKey(v))!).push(v);
  }

  for (const v of vehicles) {
    let spec: PS = {};
    let confidence = 0;
    let fonte = 'nenhuma';
    let metodo = 'fipe_inferido';

    spec = merge(spec, fromStatic(staticCat[v.vehicleId]?.specs));
    if (hasSpec(spec)) {
      confidence = 0.65;
      fonte = 'static-catalog';
      metodo = 'static_catalog';
    }

    const inf = fromInfer(v.modelo);
    if (inf.potencia || inf.transmissao || inf.torque) {
      spec = merge(spec, inf);
      confidence = Math.max(confidence, inf.potencia ? 0.55 : 0.45);
      if (fonte === 'nenhuma') {
        fonte = 'fipe-modelo';
        metodo = 'fipe_inferido';
      }
    }

    let best = 0;
    let capturedAt: string | undefined;
    let bestRow: ManufacturerRecord | null = null;
    for (const row of mfrRows) {
      const sc = manufacturerScore({ marca: v.marca, modelo: v.modelo, ano: v.ano }, row);
      if (sc > best) {
        best = sc;
        bestRow = row;
      }
    }
    if (bestRow && best >= MATCH_OEM_PAGE) {
      spec = merge(spec, fromMfr(bestRow));
      confidence = Math.max(confidence, best);
      fonte = bestRow.fonte ?? 'fabricante';
      metodo = 'fabricante';
      capturedAt = bestRow.capturadoEm;
    }

    const gen = resolveGeneration(v.marca, v.modeloSlug, v.ano, genCatalog)?.id;
    if (gen) spec.geracao_id = gen;

    if (hasSpec(spec)) master.set(v.vehicleId, toRec(v, spec, confidence, fonte, metodo, capturedAt));
  }

  const seeds = [...master.entries()].filter(([, r]) => (r.confidence ?? 0) >= 0.7 && r.metodo === 'fabricante');
  let propagated = 0;

  for (const [seedId, seedRec] of seeds) {
    const seedV = vehicles.find((x) => x.vehicleId === seedId);
    if (!seedV) continue;
    const seed = buildSeed(seedV, toPropagatable(seedRec), seedRec.confidence ?? 0.7, seedRec.fonte, seedRec.metodo ?? 'fabricante');
    const peers = byFamily.get(familyKey(seedV)) ?? [];

    for (const peer of peers) {
      if (peer.vehicleId === seedId) continue;
      if (!canPropagateSpec(seed, peer, genCatalog)) continue;
      const ex = master.get(peer.vehicleId);
      const conf = propagationConfidence(seed.confidence, seedV.ano, peer.ano);
      if (!shouldApplyPropagation(conf, ex?.confidence)) continue;

      const merged = merge(
        {
          potencia: seedRec.potencia,
          torque: seedRec.torque,
          transmissao: seedRec.transmissao,
          porta_malas: seedRec.porta_malas,
          tanque: seedRec.tanque,
          peso: seedRec.peso,
          comprimento: seedRec.comprimento,
          largura: seedRec.largura,
          altura: seedRec.altura,
          entre_eixos: seedRec.entre_eixos,
          aceleracao0a100: seedRec.aceleracao0a100,
          velocidade_max: seedRec.velocidade_max,
          bateria_kwh: seedRec.bateria_kwh,
          autonomia_km: seedRec.autonomia_km,
          geracao_id: seedRec.geracao_id,
        },
        ex ?? {},
      );

      master.set(
        peer.vehicleId,
        toRec(peer, merged, conf, `${seedRec.fonte} (propagado)`, 'propagacao_inteligente'),
      );
      propagated++;
    }
  }

  const engineTruths = loadEngineMaster();
  const engineLinks = loadEngineGraphLinks();
  let engineApplied = 0;

  for (const v of vehicles) {
    const engineId = engineLinks.get(v.vehicleId);
    if (!engineId) continue;
    const truth = engineTruths.get(engineId);
    if (!truth) continue;

    const engineSpec = fromEngineMaster(truth);
    if (!hasSpec(engineSpec)) continue;

    const ex = master.get(v.vehicleId);
    if (!engineAddsFields(engineSpec, ex)) continue;

    const merged = merge(engineSpec, ex ?? {});
    const conf = ex ? Math.max(ex.confidence ?? 0, truth.confidence * 0.92) : truth.confidence;
    const metodo = ex?.metodo === 'fabricante' ? ex.metodo : 'engine_master';
    const fonte = ex?.metodo === 'fabricante' ? ex.fonte : truth.fonte;

    master.set(v.vehicleId, toRec(v, merged, conf, fonte, metodo, truth.captured_at));
    engineApplied++;
  }

  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(
    PATHS.specsMaster,
    JSON.stringify(
      { geradoEm: new Date().toISOString(), total: master.size, propagados: propagated, engine_aplicados: engineApplied, veiculos: Object.fromEntries(master) },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ total: master.size, fabricante: seeds.length, propagados: propagated, engine_aplicados: engineApplied }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});