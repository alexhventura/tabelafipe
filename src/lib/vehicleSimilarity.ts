import { normalizeText } from './modelFamily';

/** Tipos de carroceria comparáveis — tipos diferentes nunca são misturados. */
export type ComparableBodyType =
  | 'hatch'
  | 'sedan'
  | 'suv'
  | 'pickup'
  | 'van'
  | 'wagon'
  | 'coupe'
  | 'moto'
  | 'caminhao'
  | 'outro';

export interface SimilarityVehicleInput {
  tipo: string;
  modelo: string;
  marca: string;
  ano: number;
  valorAtual: number;
}

export function inferComparableBodyType(tipo: string, modelo: string): ComparableBodyType {
  const t = (tipo || 'carros').toLowerCase();
  if (t === 'motos') return 'moto';
  if (t === 'caminhoes') return 'caminhao';

  const m = normalizeText(modelo);
  if (/\b(pick.?up|picape|s10|hilux|ranger|amarok|frontier|toro|strada|saveiro|montana|maverick)\b/.test(m)) {
    return 'pickup';
  }
  if (/\b(furgao|furg|van|combo|sprinter|master|ducato)\b/.test(m)) return 'van';
  if (
    /\b(suv|crossover|renegade|compass|t.?cross|tcross|hr.?v|creta|tracker|kicks|nivus|taos|tiguan|ecosport|duster|captur|pulse|fastback)\b/.test(
      m,
    )
  ) {
    return 'suv';
  }
  if (/\b(sedan|sed\.)\b/.test(m) && !/\bhatch\b/.test(m)) return 'sedan';
  if (/\b(hatch|hb\b)\b/.test(m)) return 'hatch';
  if (/\b(sw|perua|variant|station)\b/.test(m)) return 'wagon';
  if (/\b(coupe)\b/.test(m)) return 'coupe';
  if (/\b4p\b/.test(m) && !/\b5p\b/.test(m)) return 'sedan';
  if (/\b5p\b/.test(m)) return 'hatch';
  return 'outro';
}

function normalizeMarca(marca: string): string {
  return normalizeText(marca).replace(/\s+/g, '');
}

function isSameMarca(a: string, b: string): boolean {
  const x = normalizeMarca(a);
  const y = normalizeMarca(b);
  return x === y || x.includes(y) || y.includes(x);
}

function priceScore(a: number, b: number): number {
  if (!a || !b) return 0;
  const diff = Math.abs(a - b) / Math.max(a, b);
  if (diff < 0.1) return 20;
  if (diff < 0.2) return 10;
  return 0;
}

/**
 * Pontuação de similaridade entre dois veículos.
 * Tipos de carroceria diferentes → 0 (descartar).
 */
export function similarityScore(vehicleA: SimilarityVehicleInput, vehicleB: SimilarityVehicleInput): number {
  const typeA = inferComparableBodyType(vehicleA.tipo, vehicleA.modelo);
  const typeB = inferComparableBodyType(vehicleB.tipo, vehicleB.modelo);
  if (typeA !== typeB) return 0;

  let score = 50;
  if (isSameMarca(vehicleA.marca, vehicleB.marca)) score += 20;
  score += priceScore(vehicleA.valorAtual, vehicleB.valorAtual);
  if (Math.abs(vehicleA.ano - vehicleB.ano) <= 2) score += 10;
  return score;
}

export function pickTopSimilarVehicles<T extends SimilarityVehicleInput & { vehicleId: string }>(
  current: SimilarityVehicleInput,
  candidates: T[],
  options?: { limit?: number; minScore?: number; excludeIds?: Set<string> },
): T[] {
  const limit = options?.limit ?? 6;
  const minScore = options?.minScore ?? 50;
  const exclude = options?.excludeIds ?? new Set<string>();

  return candidates
    .filter((c) => !exclude.has(c.vehicleId))
    .map((c) => ({ item: c, score: similarityScore(current, c) }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score || Math.abs(a.item.ano - current.ano) - Math.abs(b.item.ano - current.ano))
    .slice(0, limit)
    .map((row) => row.item);
}
