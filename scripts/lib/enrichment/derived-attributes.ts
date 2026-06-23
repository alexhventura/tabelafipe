/**
 * Atributos derivados para SEO e comparativos.
 */
import type { InmetroData, NormalizedVehicle, PriceBand, Segmento, SizeCategory, SpecsData } from './types.js';
import { inferSegment } from './derived-metrics.js';

export interface VehicleRelationIndex {
  bySegmentAno: Map<string, NormalizedVehicle[]>;
  byFamily: Map<string, NormalizedVehicle[]>;
}

export function buildVehicleRelationIndex(vehicles: NormalizedVehicle[]): VehicleRelationIndex {
  const bySegmentAno = new Map<string, NormalizedVehicle[]>();
  const byFamily = new Map<string, NormalizedVehicle[]>();
  for (const v of vehicles) {
    const seg = inferSegment(v.tipo, v.modelo);
    const sk = seg + '|' + v.ano;
    const sl = bySegmentAno.get(sk) ?? [];
    sl.push(v);
    bySegmentAno.set(sk, sl);
    const fk = v.marcaSlug + '|' + v.modeloSlug;
    const fl = byFamily.get(fk) ?? [];
    fl.push(v);
    byFamily.set(fk, fl);
  }
  return { bySegmentAno, byFamily };
}

export function inferPriceBand(valor: number): PriceBand {
  if (!valor || valor <= 0) return 'intermediario';
  if (valor < 60000) return 'economico';
  if (valor < 120000) return 'intermediario';
  if (valor < 250000) return 'premium';
  return 'luxo';
}

export function inferSizeCategory(segment: Segmento, valor: number): SizeCategory {
  if (['moto', 'caminhao', 'utilitario'].includes(segment)) return 'utilitario';
  if (segment === 'pickup' || segment === 'suv') return valor > 150000 ? 'grande' : 'medio';
  if (segment === 'hatch') return valor > 80000 ? 'medio' : 'compacto';
  return 'medio';
}

export function inferMainFuel(combustivel: string): string {
  const c = combustivel.toLowerCase();
  if (c.includes('flex')) return 'Flex';
  if (c.includes('diesel')) return 'Diesel';
  if (c.includes('eletr')) return 'Eletrico';
  if (c.includes('hibr')) return 'Hibrido';
  return combustivel;
}

export function inferEfficiencyLevel(inmetro: InmetroData | null): string | null {
  return inmetro?.classificacaoEnergetica ?? null;
}

function priceDistance(a: number, b: number): number {
  if (!a || !b) return Infinity;
  return Math.abs(a - b) / Math.max(a, b);
}

export function findCompetitors(vehicle: NormalizedVehicle, index: VehicleRelationIndex, limit = 5): string[] {
  const seg = inferSegment(vehicle.tipo, vehicle.modelo);
  const peers = index.bySegmentAno.get(seg + '|' + vehicle.ano) ?? [];
  return peers.filter(p => p.vehicleId !== vehicle.vehicleId && p.marcaSlug !== vehicle.marcaSlug)
    .sort((a, b) => priceDistance(vehicle.valor, a.valor) - priceDistance(vehicle.valor, b.valor))
    .slice(0, limit).map(p => p.vehicleId);
}

export function findSimilarVehicles(vehicle: NormalizedVehicle, index: VehicleRelationIndex, limit = 8): string[] {
  const seg = inferSegment(vehicle.tipo, vehicle.modelo);
  const band = inferPriceBand(vehicle.valor);
  const peers = index.bySegmentAno.get(seg + '|' + vehicle.ano) ?? [];
  return peers.filter(p => p.vehicleId !== vehicle.vehicleId && inferPriceBand(p.valor) === band)
    .sort((a, b) => priceDistance(vehicle.valor, a.valor) - priceDistance(vehicle.valor, b.valor))
    .slice(0, limit).map(p => p.vehicleId);
}

export function findAdjacentVersions(vehicle: NormalizedVehicle, index: VehicleRelationIndex) {
  const family = index.byFamily.get(vehicle.marcaSlug + '|' + vehicle.modeloSlug) ?? [];
  const sameFuel = family.filter(f => f.combustivelSlug === vehicle.combustivelSlug);
  const sorted = [...sameFuel].sort((a, b) => a.ano - b.ano);
  const idx = sorted.findIndex(s => s.vehicleId === vehicle.vehicleId);
  return { previous: idx > 0 ? sorted[idx - 1].vehicleId : null, next: idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1].vehicleId : null };
}

const LABELS: Record<Segmento, string> = { hatch: 'Hatch', sedan: 'Sedan', suv: 'SUV', pickup: 'Picape', wagon: 'Perua', coupe: 'Coupe', moto: 'Moto', caminhao: 'Caminhao', utilitario: 'Utilitario', outro: 'Veiculo' };

export function buildTechnicalSummary(vehicle: NormalizedVehicle, specs: SpecsData | null, inmetro: InmetroData | null, segment: Segmento): string {
  const parts = [vehicle.marca + ' ' + vehicle.modelo + ' ' + vehicle.ano, LABELS[segment]];
  if (specs?.cilindradaCc) parts.push(specs.cilindradaCc + ' cc');
  if (specs?.potenciaCv) parts.push(specs.potenciaCv + ' cv');
  if (specs?.cambio) parts.push(specs.cambio);
  parts.push(inferMainFuel(vehicle.combustivel));
  if (inmetro?.consumoCidade) parts.push(inmetro.consumoCidade + ' km/l cidade');
  return parts.join(' · ');
}