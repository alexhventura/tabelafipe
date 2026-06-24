/**
 * Matching FIPE <-> INMETRO PBEV com normalizacao de marca e familia de modelo.
 */
import { marcaSlug } from '../fipe-slug.js';
import { normalizeText, normalizeVersao } from './matching-engine.js';

const MARCA_ALIASES: Record<string, string> = {
  'gm chevrolet': 'chevrolet',
  'gm - chevrolet': 'chevrolet',
  chevrolet: 'chevrolet',
  'vw volkswagen': 'volkswagen',
  'vw - volkswagen': 'volkswagen',
  volkswagen: 'volkswagen', // FIPE plain VOLKSWAGEN (caminhoes) -> mesmo slug INMETRO
  vw: 'volkswagen',
  'mercedes-benz': 'mercedes-benz',
  'land rover': 'land rover',
  'caoa chery': 'caoa chery',
  citroen: 'citroen',
  'citroën': 'citroen',
};

export function normalizeMarcaForMatch(marca: string): string {
  const key = normalizeText(marca);
  return MARCA_ALIASES[key] ?? key;
}

/** Familia do modelo: ONIX, HB20, COROLLA — primeiro token significativo. */
export function extractModelFamily(modelo: string): string {
  const tokens = normalizeVersao(modelo).split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';
  const stop = new Set(['hatch', 'sedan', 'sed', 'sw', 'plus', 'turbo', 'flex', 'hibrido', 'eletrico']);
  for (const t of tokens) {
    if (!stop.has(t) && t.length > 1 && !/^\d/.test(t)) return t;
  }
  return tokens[0];
}

export function inmetroFamilyKey(marca: string, modelo: string): string {
  return `${normalizeMarcaForMatch(marca)}|${extractModelFamily(modelo)}`;
}

export interface InmetroMatchable {
  marca: string;
  modelo: string;
  versao?: string;
  matchKey?: string;
  versaoNormalizada?: string;
}

export function buildInmetroMatchIndex(records: InmetroMatchable[]): Map<string, InmetroMatchable[]> {
  const idx = new Map<string, InmetroMatchable[]>();
  const add = (key: string, r: InmetroMatchable) => {
    const list = idx.get(key) ?? [];
    list.push(r);
    idx.set(key, list);
  };
  for (const r of records) {
    const modeloFull = `${r.modelo} ${r.versao ?? ''}`.trim();
    add(inmetroFamilyKey(r.marca, modeloFull), r);
    add(inmetroFamilyKey(r.marca, r.modelo), r);
    if (r.matchKey) add(r.matchKey, r);
    add(`${normalizeMarcaForMatch(r.marca)}|${normalizeVersao(modeloFull)}`, r);
  }
  return idx;
}

export type InmetroMatchTier = 'exact' | 'trim' | 'family_prefix';

export interface InmetroMatchMeta {
  matchKey: string;
  tier: InmetroMatchTier;
  confidence: number;
  matchedBy: string;
}

const TRIM_TOKENS = new Set([
  's',
  'sv',
  'sl',
  'sr',
  'se',
  'sense',
  'exclusive',
  'advance',
  'adv',
  'exc',
  'sen',
  'active',
  'plus',
  'sport',
  'turbo',
  'gt',
  'gts',
  'rs',
  'sti',
]);

function extractTrimTokens(modelo: string): string[] {
  return normalizeVersao(modelo)
    .split(/\s+/)
    .filter((t) => TRIM_TOKENS.has(t));
}

export function matchInmetroForVehicleWithMeta<T extends InmetroMatchable>(
  marca: string,
  modelo: string,
  index: Map<string, T[]>,
): { record: T; meta: InmetroMatchMeta } | null {
  const marcaNorm = normalizeMarcaForMatch(marca);
  const modeloNorm = normalizeVersao(modelo);
  const fullKey = `${marcaNorm}|${modeloNorm}`;

  const fullHit = index.get(fullKey);
  if (fullHit?.length) {
    return {
      record: fullHit[0],
      meta: { matchKey: fullKey, tier: 'exact', confidence: 95, matchedBy: 'exact_key' },
    };
  }

  const family = extractModelFamily(modelo);
  const trimTokens = extractTrimTokens(modelo);
  const modeloHasNovo = modeloNorm.includes('novo');

  if (family && trimTokens.length) {
    const candidates: { key: string; list: T[]; score: number }[] = [];
    for (const [key, list] of index) {
      if (!key.startsWith(`${marcaNorm}|${family}`)) continue;
      const keyHasNovo = key.includes('novo');
      if (keyHasNovo !== modeloHasNovo) continue;
      const keyBody = key.slice(marcaNorm.length + 1);
      const matched = trimTokens.filter((t) => keyBody.includes(t));
      if (matched.length) candidates.push({ key, list, score: matched.length });
    }
    if (candidates.length) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      return {
        record: best.list[0],
        meta: {
          matchKey: best.key,
          tier: 'trim',
          confidence: 85,
          matchedBy: `trim:${trimTokens.join(',')}`,
        },
      };
    }
  }

  if (family) {
    const familyKey = `${marcaNorm}|${family}`;
    const famHit = index.get(familyKey);
    if (famHit?.length) {
      return {
        record: famHit[0],
        meta: {
          matchKey: familyKey,
          tier: 'family_prefix',
          confidence: 70,
          matchedBy: `family:${family}`,
        },
      };
    }
    for (const [key, list] of index) {
      if (!key.startsWith(`${marcaNorm}|${family}`)) continue;
      const keyHasNovo = key.includes('novo');
      if (keyHasNovo !== modeloHasNovo) continue;
      return {
        record: list[0],
        meta: {
          matchKey: key,
          tier: 'family_prefix',
          confidence: 70,
          matchedBy: `family:${family}`,
        },
      };
    }
  }
  return null;
}

export function matchInmetroForVehicle(
  marca: string,
  modelo: string,
  index: Map<string, InmetroMatchable[]>,
): InmetroMatchable | null {
  return matchInmetroForVehicleWithMeta(marca, modelo, index)?.record ?? null;
}