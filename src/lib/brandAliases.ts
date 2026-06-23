import { normalizeText } from './modelFamily';
import { marcaSlug } from './slug';

/** Aliases de consulta → slug canônico da marca. */
const BRAND_QUERY_ALIASES: Record<string, string> = {
  vw: 'volkswagen',
  volkswagen: 'volkswagen',
  gm: 'chevrolet',
  chevrolet: 'chevrolet',
  fiat: 'fiat',
  ford: 'ford',
  toyota: 'toyota',
  honda: 'honda',
  hyundai: 'hyundai',
  renault: 'renault',
  peugeot: 'peugeot',
  citroen: 'citroen',
  nissan: 'nissan',
  jeep: 'jeep',
  bmw: 'bmw',
  audi: 'audi',
  mercedes: 'mercedes-benz',
  'mercedes-benz': 'mercedes-benz',
};

const SHORT_BRAND_ALIASES = new Set(['vw', 'gm']);

export function resolveBrandSlug(query: string): string {
  const norm = normalizeText(query.trim());
  if (!norm) return '';
  if (BRAND_QUERY_ALIASES[norm]) return BRAND_QUERY_ALIASES[norm];
  return marcaSlug(query) || norm;
}

export function isBrandAliasQuery(query: string): boolean {
  const norm = normalizeText(query.trim());
  return SHORT_BRAND_ALIASES.has(norm) || BRAND_QUERY_ALIASES[norm] === resolveBrandSlug(norm) && norm !== resolveBrandSlug(norm);
}

export function getMarcaSearchTerms(marca: string): string[] {
  const slug = marcaSlug(marca);
  const terms = new Set<string>([slug, normalizeText(marca)]);
  for (const [alias, target] of Object.entries(BRAND_QUERY_ALIASES)) {
    if (target === slug) terms.add(alias);
  }
  return [...terms];
}

export function expandBrandTokens(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const token of tokens) {
    out.add(token);
    const resolved = resolveBrandSlug(token);
    if (resolved) out.add(resolved);
    for (const term of getMarcaSearchTerms(token)) out.add(term);
  }
  return [...out];
}

export function matchesMarcaQuery(query: string, marcaSlugVal: string, marcaNome: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;

  const slug = normalizeText(marcaSlugVal);
  if (resolveBrandSlug(q) === slug) return true;

  const terms = getMarcaSearchTerms(marcaNome);
  terms.push(slug);
  return terms.some((t) => t === q || t.startsWith(q) || t.includes(q));
}
