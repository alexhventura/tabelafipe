import {
  BrandSearchItem,
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
import { appendYearToTitle, formatYearLabel } from './displayYear';
import { formatVehicleTitle, sanitizeDisplayText, formatBrandName, formatTitleCase } from './display';
import {
  expandBrandTokens,
  getMarcaSearchTerms,
  isBrandAliasQuery,
  resolveBrandSlug,
} from './brandAliases';
import { buildBrandsFromFamilies } from './brandIndex';
import { marcaSlug } from './slug';

export { normalizeText } from './modelFamily';

const MOTO_HINTS = /\b(cg|cb|biz|factor|fazer|ys|pop|twister|hornet|pcx|nmax|xre|lander)\b/i;

/** Prioridade do ranking: exato > prefixo > contém. */
export const MATCH_TIER = {
  EXACT: 10000,
  ALL_TOKENS: 9000,
  MODELO_STARTS: 4000,
  MARCA_STARTS: 3000,
  MODELO_INCLUDES: 2000,
  TOKEN_PREFIX: 1500,
  OTHER: 1000,
} as const;

const POPULAR_FAMILY_BOOST: Record<string, number> = {
  sandero: 500, saveiro: 500, sentra: 500, siena: 500, spin: 500, strada: 500, sw4: 500,
  corolla: 500, civic: 480, onix: 500, gol: 500, celta: 450, cerato: 450, city: 450,
  compass: 450, creta: 450, cruze: 450, hb20: 480, hilux: 480, tracker: 450,
};

export const AUTOCOMPLETE_LIMIT = 10;
export const HIGH_CONFIDENCE_THRESHOLD = 0.95;

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

function queryTokens(query: string): string[] {
  const raw = normalizeText(query.replace(/\b(19|20)\d{2}\b/g, ''))
    .split(/\s+/)
    .filter((t) => t.length >= 1 && !FUEL_OR_SPEC_TOKENS.has(t));
  return expandBrandTokens(raw);
}

const FUEL_OR_SPEC_TOKENS = new Set([
  'diesel', 'flex', 'gasolina', 'hibrido', 'hybrid', 'turbo', 'aut', 'manual', '4x4',
]);

export function scoreTextMatch(
  modelo: string,
  marca: string,
  familia: string,
  query: string,
): number {
  const q = normalizeText(query);
  if (!q) return -1;

  const full = normalizeText(`${marca} ${modelo}`);
  if (full === q || modelo === q || familia === q) {
    return MATCH_TIER.EXACT;
  }

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
    if (token.startsWith(q)) return MATCH_TIER.TOKEN_PREFIX + token.length * 10;
  }
  if (full.includes(q)) {
    return MATCH_TIER.OTHER;
  }
  return -1;
}

interface VehicleMatch {
  score: number;
  confidence: number;
}

function tokenMatchStrength(haystack: string, token: string): 0 | 1 | 2 | 3 {
  const words = new Set([
    ...haystack.split(/\s+/),
    ...modeloTokens(haystack),
  ]);
  if (words.has(token)) return 3;
  for (const w of words) {
    if (w.startsWith(token)) return 2;
  }
  if (haystack.includes(token)) return 1;
  return 0;
}

function scoreVehicle(item: SearchIndexItem, query: string, yearFilter: number | null): VehicleMatch {
  if (yearFilter && item.ano !== yearFilter) return { score: -1, confidence: 0 };

  const modelo = getModeloNorm(item);
  const marca = getMarcaNorm(item);
  const familia = getFamilyNorm(item);
  const nome = normalizeText(item.nome);
  const full = normalizeText(`${marca} ${modelo}`);
  const fullWithYear = normalizeText(`${marca} ${modelo} ${item.ano ?? ''}`);
  const normQuery = normalizeText(query);
  const textQuery = normalizeText(query.replace(/\b(19|20)\d{2}\b/g, '').trim());
  const tokens = queryTokens(query);

  if (!textQuery && !yearFilter) return { score: -1, confidence: 0 };

  if (
    normQuery &&
    (full === normQuery ||
      fullWithYear === normQuery ||
      nome === normQuery ||
      normalizeText(item.termoBusca) === normQuery)
  ) {
    return { score: MATCH_TIER.EXACT + 500, confidence: 0.99 };
  }

  let score = -1;
  let confidence = 0;

  if (tokens.length > 0) {
    let minStrength: 0 | 1 | 2 | 3 = 3;
    let matched = 0;
    const marcaTerms = getMarcaSearchTerms(item.marca ?? '').join(' ');
    const hay = `${marca} ${marcaTerms} ${modelo} ${familia} ${nome}`;

    for (const token of tokens) {
      const strength = tokenMatchStrength(hay, token);
      if (strength === 0) {
        minStrength = 0;
        matched = 0;
        break;
      }
      matched++;
      if (strength < minStrength) minStrength = strength;
    }

    if (matched === tokens.length) {
      if (minStrength === 3 && tokens.length >= 2) {
        score = MATCH_TIER.ALL_TOKENS + tokens.length * 120;
        confidence = yearFilter ? 0.98 : 0.94;
      } else if (minStrength >= 2) {
        score = MATCH_TIER.MODELO_STARTS + tokens.length * 80;
        confidence = 0.88;
      } else {
        score = MATCH_TIER.MODELO_INCLUDES + tokens.length * 40;
        confidence = 0.75;
      }
    }
  }

  if (score < 0 && textQuery) {
    const base = scoreTextMatch(modelo, marca, familia, textQuery);
    if (base >= 0) {
      score = base;
      confidence = base >= MATCH_TIER.MODELO_STARTS ? 0.82 : 0.68;
    }
  }

  if (score < 0) return { score: -1, confidence: 0 };

  score += (POPULAR_FAMILY_BOOST[familia] ?? 0) + Math.min(item.ano ?? 0, 2030) / 100;

  if (yearFilter && item.ano === yearFilter && tokens.length >= 2 && minTokenStrength(tokens, `${marca} ${modelo} ${nome}`) >= 2) {
    confidence = Math.max(confidence, 0.97);
  }

  if (tokens.length >= 3 && yearFilter) {
    confidence = Math.max(confidence, 0.96);
  }

  return { score, confidence: Math.min(confidence, 0.99) };
}

function minTokenStrength(tokens: string[], hay: string): number {
  let min = 3;
  for (const token of tokens) {
    const s = tokenMatchStrength(hay, token);
    if (s < min) min = s;
  }
  return min;
}

function scoreFamily(family: FamilySearchItem, query: string): number {
  const marcaTerms = getMarcaSearchTerms(family.marca).join(' ');
  const base = scoreTextMatch(
    family.familia,
    `${normalizeText(family.marca)} ${marcaTerms}`,
    family.familia,
    query,
  );
  if (base < 0) return -1;
  return base + (POPULAR_FAMILY_BOOST[family.familia] ?? 0) + Math.min(family.versaoCount, 200);
}

function scoreBrand(brand: BrandSearchItem, query: string): number {
  const q = normalizeText(query);
  if (!q) return -1;

  const slug = normalizeText(brand.slug);
  const nome = normalizeText(brand.nome);
  const aliases = getMarcaSearchTerms(brand.nome);
  const resolved = resolveBrandSlug(q);

  if (slug === q || nome === q || aliases.includes(q) || resolved === slug) {
    return MATCH_TIER.EXACT + Math.min(brand.vehicleCount, 5000);
  }

  if (slug.startsWith(q) || nome.startsWith(q)) {
    return MATCH_TIER.MARCA_STARTS + q.length * 10 + Math.min(brand.vehicleCount, 2000);
  }

  for (const alias of aliases) {
    if (alias.startsWith(q)) return MATCH_TIER.MARCA_STARTS + alias.length;
    if (alias.includes(q)) return MATCH_TIER.MODELO_INCLUDES + q.length;
  }

  return -1;
}

function searchBrands(
  brands: BrandSearchItem[],
  query: string,
  tipo: VehicleTipo,
  limit = 5,
): BrandSearchItem[] {
  const q = normalizeText(query.trim());
  if (!q) return [];

  const scored: Array<{ item: BrandSearchItem; score: number }> = [];
  for (const brand of brands) {
    if (brand.tipo !== tipo) continue;
    const score = scoreBrand(brand, q);
    if (score >= 0) scored.push({ item: brand, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.item.vehicleCount - a.item.vehicleCount ||
      a.item.nome.localeCompare(b.item.nome, 'pt-BR'),
  );
  return scored.map((row) => row.item).slice(0, limit);
}

function shouldPreferBrandMatch(query: string, brand: BrandSearchItem, score: number): boolean {
  const q = normalizeText(query.trim());
  if (!q || score < 0) return false;
  if (score >= MATCH_TIER.EXACT) return true;
  if (isBrandAliasQuery(query)) return true;
  if (resolveBrandSlug(q) === brand.slug) return true;
  if (q.length <= 3 && isBrowseQuery(query) && !isBrandAliasQuery(query)) return false;
  if (q.length >= 4 && score >= MATCH_TIER.MARCA_STARTS) return true;
  return false;
}

function brandSuggestionFollowUps(
  brand: BrandSearchItem,
  families: FamilySearchItem[],
  vehicles: SearchIndexItem[],
  tipo: VehicleTipo,
  limit: number,
): SearchSuggestion[] {
  const out: SearchSuggestion[] = [];
  const brandFamilies = families
    .filter((f) => f.tipo === tipo && f.marcaSlug === brand.slug)
    .sort(
      (a, b) =>
        (POPULAR_FAMILY_BOOST[b.familia] ?? 0) - (POPULAR_FAMILY_BOOST[a.familia] ?? 0) ||
        b.versaoCount - a.versaoCount,
    );

  for (const family of brandFamilies) {
    for (const vehicle of pickFamilyVehicles(vehicles, family, 1)) {
      out.push({
        kind: 'veiculo',
        item: vehicle,
        confidence: 0.75,
        browseFamily: family.familia,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
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
    const key = `${normalizeText(item.nome)}-${item.ano ?? 0}-${item.fipeCodigo ?? item.valor}`;
    const existing = seen.get(key);
    if (!existing || (item.ano ?? 0) > (existing.ano ?? 0)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}

/** Consultas curtas (1–3 chars) mostram famílias; a partir de 4 chars ou 2+ tokens, versões reais. */
export function isBrowseQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed || normalizeFipeCodeQuery(trimmed)) return false;
  if (extractYearFromQuery(trimmed)) return false;
  if (/\s/.test(trimmed)) return false;
  const token = normalizeText(trimmed);
  return token.length > 0 && token.length <= 3;
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

function pickFamilyVehicles(
  vehicles: SearchIndexItem[],
  family: FamilySearchItem,
  maxPerFamily: number,
): SearchIndexItem[] {
  const marcaNorm = family.marcaSlug;
  const matches = vehicles.filter((v) => {
    if (v.tipo !== family.tipo) return false;
    if (marcaSlug(v.marca ?? '') !== marcaNorm) return false;
    return getFamilyNorm(v) === family.familia;
  });
  if (!matches.length) return [];

  matches.sort(
    (a, b) =>
      (b.ano ?? 0) - (a.ano ?? 0) ||
      (b.valor ?? 0) - (a.valor ?? 0) ||
      normalizeText(a.modelo ?? a.nome).localeCompare(normalizeText(b.modelo ?? b.nome)),
  );

  const seen = new Set<string>();
  const out: SearchIndexItem[] = [];
  for (const vehicle of matches) {
    const key = vehicle.fipeCodigo ?? `${normalizeText(vehicle.modelo ?? vehicle.nome)}-${vehicle.ano ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(vehicle);
    if (out.length >= maxPerFamily) break;
  }
  return out;
}

function searchFamilyRepresentatives(
  families: FamilySearchItem[],
  vehicles: SearchIndexItem[],
  query: string,
  tipo: VehicleTipo,
  limit: number,
): SearchSuggestion[] {
  const familyHits = searchFamilies(families, query, tipo, Math.min(limit, 6));
  const perFamily = Math.max(1, Math.ceil(limit / Math.max(familyHits.length, 1)));
  const out: SearchSuggestion[] = [];

  for (const family of familyHits) {
    for (const vehicle of pickFamilyVehicles(vehicles, family, perFamily)) {
      out.push({
        kind: 'veiculo',
        item: vehicle,
        confidence: 0.72,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function searchVehicles(
  index: SearchIndexItem[],
  query: string,
  tipo: VehicleTipo = 'carros',
  limit = 20,
): SearchIndexItem[] {
  return searchVehiclesWithConfidence(index, query, tipo, limit)
    .filter((r): r is Extract<SearchSuggestion, { kind: 'veiculo' }> => r.kind === 'veiculo')
    .map((r) => r.item);
}

export function searchVehiclesWithConfidence(
  index: SearchIndexItem[],
  query: string,
  tipo: VehicleTipo = 'carros',
  limit = 20,
): SearchSuggestion[] {
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
    return dedupeVehicles(hits)
      .slice(0, limit)
      .map((item) => ({
        kind: 'veiculo' as const,
        item,
        confidence: item.fipeCodigo === fipeCode ? 0.99 : 0.9,
      }));
  }

  const yearFilter = extractYearFromQuery(trimmed);
  const textPart = trimmed.replace(/\b(19|20)\d{2}\b/g, '').trim();
  const queryWithoutYear = normalizeText(textPart);
  if (queryWithoutYear.length < 1 && !yearFilter) return [];

  const scored: Array<{ item: SearchIndexItem; score: number; confidence: number }> = [];
  let maxScore = 0;

  for (const item of index) {
    if (item.tipo !== tipo) continue;
    const { score, confidence } = scoreVehicle(item, trimmed, yearFilter);
    if (score < 0) continue;
    if (score > maxScore) maxScore = score;
    scored.push({ item, score, confidence });
  }

  scored.sort((a, b) => b.score - a.score || (b.item.ano ?? 0) - (a.item.ano ?? 0));

  const seen = new Set<string>();
  const deduped: Array<{ item: SearchIndexItem; score: number; confidence: number }> = [];
  for (const row of scored) {
    const key = `${normalizeText(row.item.nome)}-${row.item.ano ?? 0}-${row.item.fipeCodigo ?? row.item.valor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= limit) break;
  }

  return deduped.map((row, i, arr) => {
    let confidence = row.confidence;
    if (maxScore > 0 && row.score >= maxScore * 0.98 && arr.length === 1) {
      confidence = Math.max(confidence, 0.97);
    }
    if (yearFilter && queryTokens(trimmed).length >= 2) {
      confidence = Math.max(confidence, 0.95);
    }
    return { kind: 'veiculo' as const, item: row.item, confidence: Math.min(confidence, 0.99) };
  });
}

/** Autocomplete: marca → família → veículo, com fallback por alias de marca. */
export function searchSuggestions(
  families: FamilySearchItem[],
  vehicles: SearchIndexItem[],
  query: string,
  tipo: VehicleTipo = 'carros',
  limit = AUTOCOMPLETE_LIMIT,
): SearchSuggestion[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const fipeCode = normalizeFipeCodeQuery(trimmed);
  if (fipeCode) {
    return searchVehiclesWithConfidence(vehicles, trimmed, tipo, limit);
  }

  const brands = buildBrandsFromFamilies(families);
  const brandHits = searchBrands(brands, trimmed, tipo, 3);
  if (brandHits.length > 0) {
    const topBrand = brandHits[0];
    const brandScore = scoreBrand(topBrand, trimmed);
    if (shouldPreferBrandMatch(trimmed, topBrand, brandScore)) {
      const out: SearchSuggestion[] = [
        {
          kind: 'marca',
          item: topBrand,
          confidence: brandScore >= MATCH_TIER.EXACT ? 0.98 : 0.9,
        },
        ...brandSuggestionFollowUps(topBrand, families, vehicles, tipo, limit - 1),
      ];
      return out.slice(0, limit);
    }
  }

  if (isBrowseQuery(trimmed)) {
    const browse = searchFamilyRepresentatives(families, vehicles, trimmed, tipo, limit);
    if (browse.length > 0) return browse;
  }

  const familyHits = searchFamilies(families, trimmed, tipo, 6);
  const vehicleResults = searchVehiclesWithConfidence(vehicles, trimmed, tipo, limit);
  if (familyHits.length > 0) {
    const familyScore = scoreFamily(familyHits[0], trimmed);
    if (
      familyScore >= MATCH_TIER.MODELO_STARTS &&
      (!vehicleResults.length || vehicleResults[0].confidence < 0.85)
    ) {
      const out: SearchSuggestion[] = familyHits.slice(0, 3).map((family) => ({
        kind: 'familia' as const,
        item: family,
        confidence: 0.88,
      }));
      for (const vehicle of vehicleResults) {
        out.push(vehicle);
        if (out.length >= limit) break;
      }
      return out.slice(0, limit);
    }
  }

  return vehicleResults;
}

export function isHighConfidenceMatch(suggestions: SearchSuggestion[]): boolean {
  if (!suggestions.length) return false;
  const top = suggestions[0];
  if (top.confidence < HIGH_CONFIDENCE_THRESHOLD) return false;
  if (suggestions.length === 1) return true;
  const second = suggestions[1];
  return top.confidence - second.confidence >= 0.08;
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

export function formatVehicleSuggestionTitle(item: SearchIndexItem): string {
  const name = formatTitleCase(sanitizeDisplayText(item.nome.replace(/\s*\(\d{4}\)\s*$/, '').trim()));
  return formatVehicleTitle(name, { ano: item.ano, anoModelo: item.ano });
}

export function formatVehicleSuggestionSubtitle(item: SearchIndexItem): string {
  return item.fipeCodigo ? `FIPE ${item.fipeCodigo}` : 'Consultar FIPE';
}

/** @deprecated Use formatVehicleSuggestionTitle */
export function formatSearchResultLabel(item: SearchIndexItem): string {
  return formatVehicleSuggestionTitle(item);
}

export function formatBrandLabel(item: BrandSearchItem): string {
  return formatBrandName(item.nome, item.slug);
}

export function formatBrandMeta(item: BrandSearchItem): string {
  return `Marca · ${item.familyCount} modelo${item.familyCount > 1 ? 's' : ''}`;
}

export function formatFamilyLabel(item: FamilySearchItem): string {
  return `${formatBrandName(item.marca, item.marcaSlug)} ${formatFamilyDisplay(item.familiaDisplay || item.familia)}`;
}

export function formatFamilyMeta(item: FamilySearchItem): string {
  const anos =
    item.anoMin === item.anoMax ? String(item.anoMax) : `${item.anoMin}–${item.anoMax}`;
  return `${item.versaoCount} versões · ${anos}`;
}

export { extractFamilyName, formatFamilyDisplay, MODEL_LEADING_SKIP, MODEL_NOISE_WORDS, modeloTokens };
