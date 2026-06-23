export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const MARCA_ALIASES: Record<string, string> = {
  'gm - chevrolet': 'chevrolet',
  chevrolet: 'chevrolet',
  gm: 'chevrolet',
  'vw - volkswagen': 'volkswagen',
  volkswagen: 'volkswagen',
  vw: 'volkswagen',
  'mercedes-benz': 'mercedes-benz',
  citroën: 'citroen',
  citroen: 'citroen',
};

export function marcaSlug(marca: string): string {
  const lower = marca.toLowerCase().trim();
  if (MARCA_ALIASES[lower]) return MARCA_ALIASES[lower];
  const stripped = lower.replace(/^(gm\s*-\s*|vw\s*-\s*)/i, '');
  return slugify(stripped);
}

export function vehiclePath(marca: string, vehicleId: string): string {
  return `/fipe/${marcaSlug(marca)}/${vehicleId}`;
}

export function fipeCodigoSlug(fipeCodigo: string): string {
  return slugify(String(fipeCodigo).replace(/\./g, '-'));
}

export function buildPageSlug(modelo: string, ano: number | string, fipeCodigo: string): string {
  return `${slugify(modelo)}-${ano}-${fipeCodigoSlug(fipeCodigo)}`;
}

export function vehicleCanonicalPath(
  marca: string,
  modelo: string,
  ano: number,
  fipeCodigo: string,
): string {
  return `/fipe/${marcaSlug(marca)}/${buildPageSlug(modelo, ano, fipeCodigo)}/`;
}

/** Slug da família do modelo (alinhado ao build SEO). */
export function modeloSlug(modelo: string): string {
  const base = modelo
    .replace(/\s+\d[\d.,]*\s*.*/i, '')
    .replace(/\s+(flex|diesel|gasolina|hibrido|hybrid|aut|manual).*$/i, '')
    .trim();
  return slugify(base || modelo);
}
