/**
 * Metricas derivadas — sempre marcadas como derived. Nunca inventa specs tecnicas.
 */
import type {
  CategoriaPecas,
  DerivedMetrics,
  HistoricoPonto,
  InmetroData,
  NormalizedVehicle,
  Segmento,
  SpecsData,
  UsageProfile,
  VehicleTipo,
} from './types.js';
import { normalizeText } from './matching-engine.js';
import {
  buildTechnicalSummary,
  buildVehicleRelationIndex,
  findAdjacentVersions,
  findCompetitors,
  findSimilarVehicles,
  inferEfficiencyLevel,
  inferMainFuel,
  inferPriceBand,
  inferSizeCategory,
  type VehicleRelationIndex,
} from './derived-attributes.js';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function parseRef(ref: string): Date | null {
  const m = ref.match(/^([A-Za-z]{3})\/(\d{2,4})$/);
  if (!m) return null;
  const mi = MESES.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
  if (mi < 0) return null;
  let year = parseInt(m[2], 10);
  if (year < 100) year += year >= 50 ? 1900 : 2000;
  return new Date(year, mi, 1);
}

function sortHistorico(historico: HistoricoPonto[]): HistoricoPonto[] {
  return [...historico].sort((a, b) => (parseRef(a.referencia)?.getTime() ?? 0) - (parseRef(b.referencia)?.getTime() ?? 0));
}

function valorEmMesesAtras(historico: HistoricoPonto[], meses: number): number | null {
  if (historico.length < 2) return null;
  const sorted = sortHistorico(historico);
  const ultimo = sorted[sorted.length - 1];
  const ultimaData = parseRef(ultimo.referencia);
  if (!ultimaData) return null;
  const alvo = new Date(ultimaData);
  alvo.setMonth(alvo.getMonth() - meses);
  let melhor: HistoricoPonto | null = null;
  let melhorDiff = Infinity;
  for (const p of sorted) {
    const d = parseRef(p.referencia);
    if (!d) continue;
    const diff = Math.abs(d.getTime() - alvo.getTime());
    if (diff < melhorDiff) { melhorDiff = diff; melhor = p; }
  }
  return melhor?.valor ?? null;
}

export function calcPriceTrend(historico: HistoricoPonto[], meses: number): number | null {
  if (historico.length < 2) return null;
  const sorted = sortHistorico(historico);
  const atual = sorted[sorted.length - 1].valor;
  const passado = valorEmMesesAtras(historico, meses);
  if (passado == null || passado === 0) return null;
  return Math.round(((atual - passado) / passado) * 10000) / 100;
}

export function calcDepreciationRate(historico: HistoricoPonto[]): number | null {
  if (historico.length < 12) return null;
  const sorted = sortHistorico(historico);
  const primeiro = sorted[0].valor;
  const ultimo = sorted[sorted.length - 1].valor;
  if (primeiro === 0) return null;
  const d0 = parseRef(sorted[0].referencia);
  const d1 = parseRef(sorted[sorted.length - 1].referencia);
  if (!d0 || !d1) return null;
  const anos = (d1.getTime() - d0.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (anos < 0.5) return null;
  return Math.round((((ultimo - primeiro) / primeiro) * 100 / anos) * 100) / 100;
}

export function inferSegment(tipo: VehicleTipo, modelo: string): Segmento {
  if (tipo === 'motos') return 'moto';
  if (tipo === 'caminhoes') return 'caminhao';
  const m = normalizeText(modelo);
  if (/\b(pick.?up|picape|s10|hilux|ranger|amarok|frontier|toro|strada)\b/.test(m)) return 'pickup';
  if (/\b(suv|crossover|renegade|compass|t.?cross|tcross|hr.?v|creta|tracker|kicks|nivus|taos|tiguan)\b/.test(m)) return 'suv';
  if (/\b(sedan|sed\.|4p)\b/.test(m) && !/\bhatch\b/.test(m)) return 'sedan';
  if (/\b(hatch|hb\b|5p)\b/.test(m)) return 'hatch';
  if (/\b(sw|perua|variant|station)\b/.test(m)) return 'wagon';
  if (/\b(coupe|coupe)\b/.test(m)) return 'coupe';
  if (/\b(furgao|van|furg)\b/.test(m)) return 'utilitario';
  if (/\b4p\b/.test(m)) return 'sedan';
  if (/\b5p\b/.test(m)) return 'hatch';
  return 'outro';
}

export function inferCategoriaPecas(marca: string, valor: number): CategoriaPecas {
  const x = normalizeText(marca);
  if (['bmw','mercedes','audi','porsche','land rover','jaguar','volvo'].some((p) => x.includes(p))) return 'alta';
  if (valor > 150_000) return 'alta';
  if (['fiat','renault','chevrolet','vw','volkswagen','hyundai','citroen'].some((p) => x.includes(p))) return 'baixa';
  if (valor > 0 && valor < 60_000) return 'baixa';
  return 'media';
}

export function inferUsageProfile(segment: Segmento, inmetro: InmetroData | null): UsageProfile {
  if (inmetro?.consumoCidade != null && inmetro.consumoEstrada != null) {
    const ratio = inmetro.consumoEstrada / inmetro.consumoCidade;
    if (ratio > 1.15) return 'estrada';
    if (ratio < 1.05) return 'urbano';
    return 'misto';
  }
  if (['pickup','caminhao','moto','suv'].includes(segment)) return 'misto';
  return 'urbano';
}

export function calcAffordabilityScore(valor: number, segmentPrices: number[]): number | null {
  if (!valor || valor <= 0 || segmentPrices.length < 5) return null;
  const sorted = [...segmentPrices].sort((a, b) => a - b);
  const cheaper = sorted.filter((p) => p <= valor).length;
  return Math.max(0, Math.min(100, Math.round((cheaper / sorted.length) * 100)));
}

export function calcMarketPosition(valor: number, peerPrices: number[]): { rank: number | null; percentile: number | null } {
  if (!valor || peerPrices.length < 2) return { rank: null, percentile: null };
  const sorted = [...peerPrices].sort((a, b) => a - b);
  const rank = sorted.filter((p) => p <= valor).length;
  return { rank, percentile: Math.round((rank / sorted.length) * 100) };
}

export interface SegmentPriceIndex {
  get(segment: Segmento, ano: number): number[];
}

export function buildSegmentPriceIndex(vehicles: NormalizedVehicle[]): SegmentPriceIndex {
  const map = new Map<string, number[]>();
  for (const v of vehicles) {
    if (!v.valor || v.valor <= 0) continue;
    const seg = inferSegment(v.tipo, v.modelo);
    const key = `${seg}|${v.ano}`;
    const list = map.get(key) ?? [];
    list.push(v.valor);
    map.set(key, list);
  }
  return { get(segment, ano) { return map.get(`${segment}|${ano}`) ?? []; } };
}

export function buildDerivedMetrics(
  vehicle: NormalizedVehicle,
  historico: HistoricoPonto[],
  inmetro: InmetroData | null,
  priceIndex: SegmentPriceIndex,
  relationIndex?: VehicleRelationIndex,
  specs?: SpecsData | null,
): DerivedMetrics {
  const segment = inferSegment(vehicle.tipo, vehicle.modelo);
  const categoria = inferCategoriaPecas(vehicle.marca, vehicle.valor);
  const peerPrices = priceIndex.get(segment, vehicle.ano);
  const { rank, percentile } = calcMarketPosition(vehicle.valor, peerPrices);
  const rel = relationIndex ?? buildVehicleRelationIndex([]);
  const adj = findAdjacentVersions(vehicle, rel);
  return {
    price_trend_12m: calcPriceTrend(historico, 12),
    price_trend_24m: calcPriceTrend(historico, 24),
    depreciation_rate: calcDepreciationRate(historico),
    market_position_rank: rank,
    market_position_percentile: percentile,
    segment,
    size_category: inferSizeCategory(segment, vehicle.valor),
    price_band: inferPriceBand(vehicle.valor),
    main_fuel: inferMainFuel(vehicle.combustivel),
    efficiency_level: inferEfficiencyLevel(inmetro),
    affordability_score: calcAffordabilityScore(vehicle.valor, peerPrices),
    maintenance_estimate: {
      categoria,
      perfil: categoria === 'alta' ? 'premium' : categoria === 'baixa' ? 'economico' : 'medio',
      fonte: 'derived',
      metodo: 'categoria_pecas_por_marca_valor',
    },
    usage_profile: inferUsageProfile(segment, inmetro),
    competitors: relationIndex ? findCompetitors(vehicle, relationIndex) : [],
    similar_vehicles: relationIndex ? findSimilarVehicles(vehicle, relationIndex) : [],
    previous_version_id: adj.previous,
    next_version_id: adj.next,
    technical_summary: buildTechnicalSummary(vehicle, specs ?? null, inmetro, segment),
    fonte: 'derived',
  };
}