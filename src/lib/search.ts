import {
  FamilySearchItem,
  SearchIndexItem,
  SearchSuggestion,
  VehicleTipo,
} from '../types';
import {
  extractFamilyName,
  formatFamilyDisplay,
  MODEL_LEADING_SKIP,
  MODEL_NOISE_WORDS,
  modeloTokens,
  normalizeText,
} from './modelFamily';

export { normalizeText } from './modelFamily';

const SINONIMOS: Record<string, string[]> = {
  vw: ['volkswagen', 'vw'],
  volkswagen: ['volkswagen', 'vw'],
  gm: ['chevrolet', 'gm'],
  chevrolet: ['chevrolet', 'gm'],
  chevy: ['chevrolet'],
};

const MOTO_HINTS = /\b(cg|cb|biz|factor|fazer|ys|pop|twister|hornet|pcx|nmax|xre|lander)\b/i;

const FUEL_OR_SPEC_TOKENS = new Set([
  'diesel', 'flex', 'gasolina', 'hibrido', 'hybrid', 'turbo', 'aut', 'manual', '4x4',
]);

/** Prioridade 1–4 do ranking de busca. */
export const MATCH_TIER = {
  MODELO_STARTS: 4000,
  MARCA_STARTS: 3000,
  MODELO_INCLUDES: 2000,
  OTHER: 1000,
} as const;

const POPULAR_FAMILY_BOOST: Record<string, number> = {
  sandero: 500, saveiro: 500, sentra: 500, siena: 500, spin: 500, strada: 500, sw4: 500,
  corolla: 500, civic: 480, onix: 500, gol: 500, celta: 450, cerato: 450, city: 450,
  compass: 450, creta: 450, cruze: 450, hb20: 480, hilux: 480, tracker: 450,
};

export const AUTOCOMPLETE_LIMIT = 10;

export function extractYearFromQuery(query: string): number | null {
  const match = query.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

/** Normaliza codigo FIPE: 001234-5, 0012345, 1234-5 */
export function normalizeFipeCodeQuery(query: string): string | null {
  const compact = query.replace(/[^\d-]/g, '');
  const m = compact.match(/^(\d{4,6})-?(\d)$/);
  if (!m) return null;
  const digits = m[1].padStart(6, '0');
  return `${digits}-${m[2]}`;
}

function getModeloNorm(item: SearchIndexItem): string {
  return normalizeText(item.modelo ?? item.searchText ?? item.nome);
}

function getMarcaNorm(item: SearchIndexItem): string {
  return normalizeText(item.marca ?? '');
}

function getFamilyNorm(item: SearchIndexItem): string {
  return extractFamilyName(item.modelo ?? item.nome);
}

export function scoreTextMatch(
  modelo: string,
  marca: string,
  familia: string,
  query: string,
): number {
  const q = normalizeText(query);
  if (!q) return -1;

  if (familia.startsWith(q) || modelo.startsWith(q)) {
    return MATCH_TIER.MODELO_STARTS + familia.length;
  }
  if (marca.startsWith(q)) {
    return MATCH_TIER.MARCA_STARTS + marca.length;
  }
  if (familia.includes(q) || modelo.includes(q)) {
    return MATCH_TIER.MODELO_INCLUDES + q.length;
  }

  const tokens = [...modeloTokens(modelo), ...modeloTokens(familia)];
  for (const token of tokens) {
    if (token.startsWith(q)) return MATCH_TIER.OTHER + token.length * 10;
  }
  if (normalizeText(`${marca} ${modelo}`).includes(q)) {
    return MATCH_TIER.OTHER;
  }
  return -1;
}

function scoreFamily(family: FamilySearchItem, query: string): number {
  const base = scoreTextMatch(family.familia, normalizeText(family.marca), family.familia, query);
  if (base < 0) return -1;
  return base + (POPULAR_FAMILY_BOOST[family.familia] ?? 0) + Math.min(family.versaoCount, 200);
}

function scoreVehicle(item: SearchIndexItem, query: string, yearFilter: number | null): number {
  if (yearFilter && item.ano !== yearFilter) return -1;
  const modelo = getModeloNorm(item);
  const marca = getMarcaNorm(item);
  const familia = getFamilyNorm(item);
  const base = scoreTextMatch(modelo, marca, familia, query);
  if (base < 0) return -1;
  return base + (POPULAR_FAMILY_BOOST[familia] ?? 0) + Math.min(item.ano ?? 0, 2030) / 100;
}

function dedupeFamilies(items: FamilySearchItem[]): FamilySearchItem[] {
  const seen = new Map<string, FamilySearchItem>();
  for (const item of items) {
    const existing = seen.get(item.id);
    if (!existing || item.versaoCount > existing.versaoCount) {
      seen.set(item.id, item);
    }
  }
  return [...seen.values()];
}

function dedupeVehicles(items: SearchIndexItem[]): SearchIndexItem[] {
  const seen = new Map<string, SearchIndexItem>();
  for (const item of items) {
    const key = `${normalizeText(item.nome)}-${item.ano ?? 0}-${item.valor}`;
    const existing = seen.get(key);
    if (!existing || (item.ano ?? 0) > (existing.ano ?? 0)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}

export function searchFamilies(
  families: FamilySearchItem[],
  query: string,
  tipo: VehicleTipo = 'carros',
  limit = AUTOCOMPLETE_LIMIT,
): FamilySearchItem[] {
  const q = normalizeText(query.trim());
  if (!q) return [];

  const scored: Array<{ item: FamilySearchItem; score: number }> = [];
  for (const family of families) {
    if (family.tipo !== tipo) continue;
    const score = scoreFamily(family, q);
    if (score >= 0) scored.push({ item: family, score });
  }

  scored.sort((a, b) => b.score - a.score || b.item.versaoCount - a.item.versaoCount);
  return dedupeFamilies(scored.map((s) => s.item)).slice(0, limit);
}

export function searchVehicles(
  index: SearchIndexItem[],
  query: string,
  tipo: VehicleTipo = 'carros',
  limit = 20,
): SearchIndexItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const fipeCode = normalizeFipeCodeQuery(trimmed);
  if (fipeCode) {
    const hits = index.filter(
      (item) => item.tipo === tipo && item.fipeCodigo && item.fipeCodigo.startsWith(fipeCode.split('-')[0]),
    );
    hits.sort((a, b) => {
      if (a.fipeCodigo === fipeCode && b.fipeCodigo !== fipeCode) return -1;
      if (b.fipeCodigo === fipeCode && a.fipeCodigo !== fipeCode) return 1;
      return (b.ano ?? 0) - (a.ano ?? 0);
    });
    return dedupeVehicles(hits).slice(0, limit);
  }

  const yearFilter = extractYearFromQuery(trimmed);
  const queryWithoutYear = normalizeText(trimmed).replace(/\b(19|20)\d{2}\b/g, '').trim();
  if (queryWithoutYear.length < 1 && !yearFilter) return [];

  const scored: Array<{ item: SearchIndexItem; score: number }> = [];
  for (const item of index) {
    if (item.tipo !== tipo) continue;
    const score = scoreVehicle(item, queryWithoutYear || normalizeText(trimmed), yearFilter);
    if (score >= 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score || (b.item.ano ?? 0) - (a.item.ano ?? 0));
  return dedupeVehicles(scored.map((s) => s.item)).slice(0, limit);
}

/** Autocomplete: famílias para texto curto; veículos para FIPE ou consulta com espaço. */
export function searchSuggestions(
  families: FamilySearchItem[],
  vehicles: SearchIndexItem[],
  query: string,
  tipo: VehicleTipo = 'carros',
  limit = AUTOCOMPLETE_LIMIT,
): SearchSuggestion[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (normalizeFipeCodeQuery(trimmed)) {
    return searchVehicles(vehicles, trimmed, tipo, limit).map((item) => ({ kind: 'veiculo', item }));
  }

  const hasSpaces = /\s/.test(trimmed);
  if (hasSpaces) {
    return searchVehicles(vehicles, trimmed, tipo, limit).map((item) => ({ kind: 'veiculo', item }));
  }

  const familyHits = searchFamilies(families, trimmed, tipo, limit);
  if (familyHits.length > 0) {
    return familyHits.map((item) => ({ kind: 'familia', item }));
  }

  return searchVehicles(vehicles, trimmed, tipo, limit).map((item) => ({ kind: 'veiculo', item }));
}

export function extractFilterChips(index: SearchIndexItem[], query: string, tipo: VehicleTipo): string[] {
  const results = searchVehicles(index, query, tipo, 200);
  const years = new Set<number>();
  for (const item of results) {
    if (item.ano) years.add(item.ano);
  }
  return [...years]
    .sort((a, b) => b - a)
    .slice(0, 8)
    .map(String);
}

export function looksLikeMotoQuery(query: string): boolean {
  return MOTO_HINTS.test(normalizeText(query));
}

export function benchmarkSearch(
  families: FamilySearchItem[],
  vehicles: SearchIndexItem[],
  query: string,
  tipo: VehicleTipo = 'carros',
): { ms: number; count: number } {
  const start = performance.now();
  const count = searchSuggestions(families, vehicles, query, tipo, AUTOCOMPLETE_LIMIT).length;
  return { ms: performance.now() - start, count };
}

export function formatSearchResultLabel(item: SearchIndexItem): string {
  const base = item.nome.replace(/\s*\(\d{4}\)\s*$/, '');
  const parts = [base];
  if (item.combustivel) parts.push(item.combustivel);
  if (item.ano) parts.push(String(item.ano));
  return parts.join(' · ');
}

export function formatFamilyLabel(item: FamilySearchItem): string {
  return `${item.marca} ${item.familiaDisplay}`;
}

export function formatFamilyMeta(item: FamilySearchItem): string {
  const anos =
    item.anoMin === item.anoMax ? String(item.anoMax) : `${item.anoMin}–${item.anoMax}`;
  return `${item.versaoCount} versões · ${anos}`;
}

// Re-export helpers used by build scripts / tests
export { extractFamilyName, formatFamilyDisplay, MODEL_LEADING_SKIP, MODEL_NOISE_WORDS, modeloTokens };
