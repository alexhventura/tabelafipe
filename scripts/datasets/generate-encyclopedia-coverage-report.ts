/**
 * Relatorio multidimensional de cobertura da enciclopedia (18 camadas).
 * Mede: global, por categoria, por fabricante, por geracao, ponderada por relevancia.
 */
import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';
import { ALL_ENCYCLOPEDIA_FIELDS, ENCYCLOPEDIA_LAYERS } from '../lib/data-architecture.js';
import { normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import { resolveGeneration } from '../lib/enrichment/generation-match.js';
import { loadGenerationsCatalog } from '../lib/enrichment/generation-match.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

type DimStats = { preenchidos: number; total: number; pct: number; meta?: number; atingiu?: boolean };

interface FieldQualityRow { campo: string; preenchidos: number; total: number; taxaPct: number }

function pct(n: number, t: number) { return t ? Math.round((n / t) * 10000) / 100 : 0; }

function loadVehicles(): NormalizedVehicle[] {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  return (JSON.parse(fs.readFileSync(file, 'utf-8')) as NormalizedVehicle[]).map((v) => (v.vehicleId ? v : normalizeVehicle(v)));
}

function loadFieldQuality(): Map<string, FieldQualityRow> {
  const m = new Map<string, FieldQualityRow>();
  const fq = fs.existsSync(PATHS.fieldQualityReport)
    ? (JSON.parse(fs.readFileSync(PATHS.fieldQualityReport, 'utf-8')) as { campos?: FieldQualityRow[] }).campos ?? []
    : [];
  for (const r of fq) m.set(r.campo, r);
  return m;
}

function hasField(vehicle: NormalizedVehicle, fieldId: string, ctx: {
  quality: Map<string, FieldQualityRow>;
  specsMaster: Record<string, Record<string, unknown>>;
  staticCat: Record<string, { specs?: Record<string, unknown> }>;
  enrichedIds: Set<string>;
  genCatalog: ReturnType<typeof loadGenerationsCatalog>;
}): boolean {
  const def = ALL_ENCYCLOPEDIA_FIELDS.find((f) => f.id === fieldId);
  if (!def) return false;

  const sm = ctx.specsMaster[vehicle.vehicleId];
  const st = ctx.staticCat[vehicle.vehicleId]?.specs;

  switch (fieldId) {
    case 'vehicle_uid': return !!vehicle.vehicleUid;
    case 'marca': case 'modelo': case 'combustivel': case 'codigo_fipe': case 'ano_modelo': case 'categoria':
      return true;
    case 'versao': return !!vehicle.versaoNormalizada;
    case 'geracao': return !!resolveGeneration(vehicle.marca, vehicle.modeloSlug, vehicle.ano, ctx.genCatalog);
    case 'preco_fipe_atual': return vehicle.valor > 0;
    case 'historico_precos': return ctx.enrichedIds.has(vehicle.vehicleId) || fs.existsSync(`${PATHS.historyRoot}/${vehicle.vehicleId}.json`);
    case 'potencia': return !!(sm?.potencia ?? (st?.potencia as { valor?: number })?.valor);
    case 'torque': return !!(sm?.torque ?? (st?.torque as { valor?: number })?.valor);
    case 'cilindrada': return !!(st?.cilindrada);
    case 'transmissao': case 'tipo_cambio': return !!(sm?.transmissao ?? st?.cambio);
    case 'consumo_urbano': {
      const c = st?.consumo as { cidadeG?: number } | undefined;
      return !!(c?.cidadeG);
    }
    case 'consumo_rodoviario': {
      const c = st?.consumo as { estradaG?: number } | undefined;
      return !!(c?.estradaG);
    }
    case 'classificacao_energetica': return !!(st?.classificacaoEnergetica);
    case 'porta_malas': return !!(sm?.porta_malas ?? (st?.portaMalas as { valor?: number })?.valor);
    case 'tanque': return !!(sm?.tanque ?? (st?.tanque as { valor?: number })?.valor);
    case 'concorrentes': case 'semelhantes': return ctx.enrichedIds.has(vehicle.vehicleId);
    case 'rel_marcas': return !!vehicle.marcaSlug;
    default:
      return false;
  }
}

function aggregate(
  vehicles: NormalizedVehicle[],
  fieldId: string,
  ctx: Parameters<typeof hasField>[2],
  weightFn: (v: NormalizedVehicle) => number,
): { stats: DimStats; ponderadaPct: number } {
  const def = ALL_ENCYCLOPEDIA_FIELDS.find((f) => f.id === fieldId);
  let filled = 0;
  let weightedFilled = 0;
  let totalWeight = 0;
  for (const v of vehicles) {
    const w = weightFn(v);
    totalWeight += w;
    if (hasField(v, fieldId, ctx)) {
      filled++;
      weightedFilled += w;
    }
  }
  const total = vehicles.length;
  const stats: DimStats = {
    preenchidos: filled,
    total,
    pct: pct(filled, total),
    meta: def?.metaCoberturaPct,
    atingiu: def?.metaCoberturaPct != null ? pct(filled, total) >= def.metaCoberturaPct : undefined,
  };
  return { stats, ponderadaPct: pct(weightedFilled, totalWeight) };
}

async function main() {
  const vehicles = loadVehicles();
  const quality = loadFieldQuality();
  const genCatalog = loadGenerationsCatalog();
  const specsMaster = fs.existsSync(PATHS.specsMaster)
    ? (JSON.parse(fs.readFileSync(PATHS.specsMaster, 'utf-8')) as { veiculos: Record<string, Record<string, unknown>> }).veiculos
    : {};
  const staticCat = fs.existsSync(PATHS.staticSpecsCatalog)
    ? (JSON.parse(fs.readFileSync(PATHS.staticSpecsCatalog, 'utf-8')) as Record<string, { specs?: Record<string, unknown> }>)
    : {};
  const enrichedIds = new Set<string>();
  if (fs.existsSync(PATHS.enrichedRoot)) {
    for (const f of fs.readdirSync(PATHS.enrichedRoot).filter((x) => x.endsWith('.json') && x !== 'manifest.json').slice(0, 5000)) {
      enrichedIds.add(f.replace(/\.json$/, ''));
    }
  }

  const ctx = { quality, specsMaster, staticCat, enrichedIds, genCatalog };
  const weightFn = (v: NormalizedVehicle) => {
    const base = ALL_ENCYCLOPEDIA_FIELDS.find((f) => f.id === 'potencia')?.pesoRelevancia ?? 0.5;
    const priceW = v.valor > 0 ? Math.min(2, Math.log10(v.valor) / 5) : 0.5;
    const tipoW = v.tipo === 'carros' ? 1.2 : v.tipo === 'motos' ? 1 : 0.8;
    return Math.max(0.1, priceW * tipoW * base);
  };

  const priorityFields = ['potencia', 'torque', 'transmissao', 'porta_malas', 'consumo_urbano', 'preco_fipe_atual', 'historico_precos', 'geracao', 'concorrentes'];
  const global: Record<string, DimStats & { ponderadaPct: number }> = {};
  for (const fid of priorityFields) {
    const { stats, ponderadaPct } = aggregate(vehicles, fid, ctx, weightFn);
    global[fid] = { ...stats, ponderadaPct };
  }

  const porCategoria: Record<string, typeof global> = {};
  for (const tipo of ['carros', 'motos', 'caminhoes'] as const) {
    const subset = vehicles.filter((v) => v.tipo === tipo);
    porCategoria[tipo] = {};
    for (const fid of priorityFields) {
      const { stats, ponderadaPct } = aggregate(subset, fid, ctx, weightFn);
      porCategoria[tipo][fid] = { ...stats, ponderadaPct };
    }
  }

  const porFabricante: Record<string, { total: number; campos: typeof global }> = {};
  const marcaCounts = new Map<string, number>();
  for (const v of vehicles) marcaCounts.set(v.marca, (marcaCounts.get(v.marca) ?? 0) + 1);
  const topMarcas = [...marcaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([m]) => m);
  for (const marca of topMarcas) {
    const subset = vehicles.filter((v) => v.marca === marca);
    const campos: typeof global = {};
    for (const fid of priorityFields) {
      const { stats, ponderadaPct } = aggregate(subset, fid, ctx, weightFn);
      campos[fid] = { ...stats, ponderadaPct };
    }
    porFabricante[marca] = { total: subset.length, campos };
  }

  const porGeracao: Record<string, { total: number; campos: typeof global }> = {};
  const genBuckets = new Map<string, NormalizedVehicle[]>();
  for (const v of vehicles) {
    const g = resolveGeneration(v.marca, v.modeloSlug, v.ano, genCatalog);
    if (!g) continue;
    const key = g.id;
    const list = genBuckets.get(key) ?? [];
    list.push(v);
    genBuckets.set(key, list);
  }
  for (const [gid, subset] of genBuckets) {
    const campos: typeof global = {};
    for (const fid of priorityFields) {
      const { stats, ponderadaPct } = aggregate(subset, fid, ctx, weightFn);
      campos[fid] = { ...stats, ponderadaPct };
    }
    porGeracao[gid] = { total: subset.length, campos };
  }

  const camadasResumo = ENCYCLOPEDIA_LAYERS.map((l) => ({
    id: l.id,
    numero: l.numero,
    titulo: l.titulo,
    totalCampos: l.campos.length,
    metaMediaCobertura: Math.round(l.campos.reduce((s, c) => s + (c.metaCoberturaPct ?? 0), 0) / l.campos.length),
  }));

  const report = {
    geradoEm: new Date().toISOString(),
    totalVeiculos: vehicles.length,
    totalCampos: ALL_ENCYCLOPEDIA_FIELDS.length,
    totalCamadas: ENCYCLOPEDIA_LAYERS.length,
    camadasResumo,
    coberturaGlobal: global,
    porCategoria,
    porFabricante,
    porGeracao,
    observacao: 'Cobertura ponderada usa peso por tipo (carros>motos>caminhoes) e faixa de preco FIPE.',
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.encyclopediaCoverageReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ totalVeiculos: vehicles.length, camadas: ENCYCLOPEDIA_LAYERS.length, campos: ALL_ENCYCLOPEDIA_FIELDS.length }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });