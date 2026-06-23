import { marcaSlug } from '../fipe-slug.js';
import { normalizeText, normalizeVersao } from './matching-engine.js';

function tokenSet(s: string): Set<string> {
  return new Set(normalizeVersao(s).split(/\s+/).filter(t => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function anoScore(a: number, b?: number): number {
  if (!b || !a) return 0.5;
  const d = Math.abs(a - b);
  if (d === 0) return 1;
  if (d === 1) return 0.9;
  if (d <= 3) return 0.75;
  if (d <= 5) return 0.5;
  return 0.2;
}

export interface MatchCandidate { marca: string; modelo: string; ano?: number }

export function computeMatchingScore(fipe: MatchCandidate, external: MatchCandidate): number {
  if (marcaSlug(fipe.marca) !== marcaSlug(external.marca)) return 0;
  const tokenSim = jaccard(tokenSet(fipe.modelo), tokenSet(external.modelo));
  const na = normalizeText(fipe.modelo);
  const nb = normalizeText(external.modelo);
  const substringBonus = na.includes(nb) || nb.includes(na) ? 0.1 : 0;
  const score = 0.15 + tokenSim * 0.55 + anoScore(fipe.ano, external.ano) * 0.2 + substringBonus;
  return Math.round(Math.min(1, score) * 1000) / 1000;
}

export function classifyCollisionReason(key: string, ids: string[], vehiclesById: Map<string, { modelo: string; ano: number }>): string {
  const parts = key.split('|');
  const hasYearInKey = parts.length >= 3 && /^\d{4}$/.test(parts[parts.length - 2] ?? '');
  const models = ids.map(id => vehiclesById.get(id)).filter(Boolean) as { modelo: string; ano: number }[];
  if (!models.length) return 'desconhecido';
  const anos = [...new Set(models.map(m => m.ano))];
  const normModels = models.map(m => normalizeText(m.modelo));
  const allSameNorm = normModels.every(n => n === normModels[0]);
  if (!hasYearInKey && anos.length > 1) return 'versao_duplicada_multi_ano';
  if (hasYearInKey && anos.length === 1 && !allSameNorm) return 'versao_diferente_mesmo_ano';
  const raw = models.map(m => m.modelo);
  if (raw.some(r => r.normalize('NFD') !== raw[0].normalize('NFD'))) return 'acentuacao';
  if (raw.some(r => /\b(MEC|AUT|CVT)\b/i.test(r) !== /\b(MEC|AUT|CVT)\b/i.test(raw[0]))) return 'abreviacao';
  if (!allSameNorm) return 'nome_comercial_vs_tecnico';
  if (anos.length > 1 && hasYearInKey) return 'ano_divergente';
  return 'versao_duplicada';
}