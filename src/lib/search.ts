import { SearchIndexItem, VehicleTipo } from '../types';

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

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function tokenMatches(text: string, token: string): boolean {
  if (text.includes(token)) return true;
  if (token.length < 4) return false;
  const words = text.split(' ').filter((w) => w.length >= 2);
  return words.some((w) => {
    if (w.length >= 4 && (w.includes(token) || token.includes(w))) return true;
    if (w.length >= 4 && token.length >= 4) {
      return levenshtein(w, token) <= 1;
    }
    return false;
  });
}

function expandQueryTokens(query: string): string[] {
  const tokens = query.split(/\s+/).filter(Boolean);
  const expanded = new Set<string>();
  for (const token of tokens) {
    expanded.add(token);
    const aliases = SINONIMOS[token];
    if (aliases) aliases.forEach((a) => expanded.add(a));
  }
  return [...expanded];
}

interface ScoredItem {
  item: SearchIndexItem;
  score: number;
}

function tokenMatchesWord(text: string, token: string): boolean {
  if (token.length <= 3) {
    const re = new RegExp(`\\b${token}\\b`);
    return re.test(text);
  }
  return tokenMatches(text, token);
}

function wordStartsWith(text: string, token: string): boolean {
  if (!token) return false;
  return text.split(' ').some((w) => w.startsWith(token));
}

function getPrimaryToken(tokens: string[]): string | null {
  for (const t of tokens) {
    if (t.length >= 4 && !FUEL_OR_SPEC_TOKENS.has(t)) return t;
  }
  return tokens[0] ?? null;
}

function scoreItem(item: SearchIndexItem, tokens: string[], yearFilter: number | null, rawQuery: string): number {
  const nome = normalizeText(item.nome);
  const searchable = item.searchText ?? nome;
  const normalizedQuery = normalizeText(rawQuery);

  if (yearFilter && item.ano !== yearFilter) return -1;

  const fipeCode = normalizeFipeCodeQuery(rawQuery);
  if (fipeCode && item.fipeCodigo) {
    if (item.fipeCodigo === fipeCode) return 10000;
    if (item.fipeCodigo.startsWith(fipeCode.split('-')[0])) return 5000;
  }

  if (normalizedQuery.length >= 2 && nome === normalizedQuery) return 9000;
  if (normalizedQuery.length >= 2 && searchable === normalizedQuery) return 8500;

  let matched = 0;
  let score = item.popularidade ?? 0;
  const primary = getPrimaryToken(tokens);

  for (const token of tokens) {
    if (tokenMatchesWord(nome, token)) {
      matched++;
      score += 40;
      if (wordStartsWith(nome, token)) score += 25;
      continue;
    }
    if (tokenMatches(searchable, token)) {
      matched++;
      score += 15;
      if (wordStartsWith(searchable, token)) score += 10;
      continue;
    }
  }

  if (matched === 0) {
    if (tokens.length === 1 && tokens[0].length === 1) {
      if (nome.startsWith(tokens[0]) || searchable.startsWith(tokens[0])) return 20 + score;
    }
    return -1;
  }
  if (matched < tokens.length) score -= (tokens.length - matched) * 15;

  if (tokens.length > 1 && tokens.every((t) => tokenMatchesWord(nome, t))) {
    score += 35;
  }

  if (primary && tokenMatchesWord(nome, primary)) {
    score += 50;
    if (nome.split(' ').some((w) => w === primary)) score += 30;
  }

  return score;
}

function dedupeResults(items: SearchIndexItem[]): SearchIndexItem[] {
  const seen = new Map<string, SearchIndexItem>();
  for (const item of items) {
    const key = `${normalizeText(item.nome)}-${item.ano ?? 0}-${item.valor}`;
    const existing = seen.get(key);
    if (!existing || (item.popularidade ?? 0) > (existing.popularidade ?? 0)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
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
      return (b.popularidade ?? 0) - (a.popularidade ?? 0);
    });
    return dedupeResults(hits).slice(0, limit);
  }

  const yearFilter = extractYearFromQuery(trimmed);
  const queryWithoutYear = normalizeText(trimmed).replace(/\b(19|20)\d{2}\b/g, '').trim();
  if (queryWithoutYear.length < 1 && !yearFilter) return [];

  if (queryWithoutYear.length === 1) {
    const letter = queryWithoutYear;
    return dedupeResults(
      index
        .filter((item) => {
          if (item.tipo !== tipo) return false;
          const nome = normalizeText(item.nome);
          const searchable = item.searchText ?? nome;
          return nome.startsWith(letter) || searchable.startsWith(letter) || nome.split(' ').some((w) => w.startsWith(letter));
        })
        .sort((a, b) => (b.popularidade ?? 0) - (a.popularidade ?? 0)),
    ).slice(0, limit);
  }

  const tokens = expandQueryTokens(queryWithoutYear || normalizeText(trimmed));
  if (tokens.length === 0 && yearFilter) {
    return index
      .filter((item) => item.tipo === tipo && item.ano === yearFilter)
      .sort((a, b) => (b.popularidade ?? 0) - (a.popularidade ?? 0))
      .slice(0, limit);
  }

  const scored: ScoredItem[] = [];
  for (const item of index) {
    if (item.tipo !== tipo) continue;
    const score = scoreItem(item, tokens, yearFilter, trimmed);
    if (score >= 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const primary = getPrimaryToken(tokens);
  const knownModel = primary && primary.length >= 5;
  const filtered = knownModel
    ? scored.filter((s) => tokenMatchesWord(normalizeText(s.item.nome), primary))
    : scored;

  const pool = filtered.length > 0 ? filtered : scored;

  return dedupeResults(pool.map((s) => s.item)).slice(0, limit);
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
  index: SearchIndexItem[],
  query: string,
  tipo: VehicleTipo = 'carros',
): { ms: number; count: number } {
  const start = performance.now();
  const count = searchVehicles(index, query, tipo, 20).length;
  return { ms: performance.now() - start, count };
}

export function formatSearchResultLabel(item: SearchIndexItem): string {
  const base = item.nome.replace(/\s*\(\d{4}\)\s*$/, '');
  const parts = [base];
  if (item.combustivel) parts.push(item.combustivel);
  if (item.ano) parts.push(String(item.ano));
  return parts.join(' · ');
}
