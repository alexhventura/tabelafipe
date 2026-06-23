import { marcaSlug, slugify } from '../lib/fipe-slug.js';

export const SITE_URL = 'https://pesquisatabelafipe.com.br';

export function fipeCodigoSlug(fipeCodigo: string): string {
  return slugify(String(fipeCodigo).replace(/\./g, '-'));
}

/** Slug unico da pagina: modelo + ano + codigo FIPE. */
export function buildPageSlug(modelo: string, ano: number | string, fipeCodigo: string): string {
  const base = slugify(modelo);
  const year = String(ano);
  const code = fipeCodigoSlug(fipeCodigo);
  return `${base}-${year}-${code}`;
}

export function buildCanonicalPath(marca: string, pageSlug: string): string {
  return `/fipe/${marcaSlug(marca)}/${pageSlug}/`;
}

export function buildCanonicalUrl(marca: string, pageSlug: string): string {
  return `${SITE_URL}${buildCanonicalPath(marca, pageSlug)}`;
}