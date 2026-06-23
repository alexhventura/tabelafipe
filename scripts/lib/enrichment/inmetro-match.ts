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

export function matchInmetroForVehicle(
  marca: string,
  modelo: string,
  index: Map<string, InmetroMatchable[]>,
): InmetroMatchable | null {
  const keys = [
    inmetroFamilyKey(marca, modelo),
    `${normalizeMarcaForMatch(marca)}|${normalizeVersao(modelo)}`,
  ];
  for (const k of keys) {
    const hit = index.get(k);
    if (hit?.length) return hit[0];
  }
  const family = extractModelFamily(modelo);
  if (!family) return null;
  for (const [key, list] of index) {
    if (key.startsWith(`${normalizeMarcaForMatch(marca)}|${family}`)) return list[0];
  }
  return null;
}