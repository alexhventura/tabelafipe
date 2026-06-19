export function slugify(text: string): string {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function marcaSlug(marca: string): string {
  const l = marca.toLowerCase();
  if (l.includes('chevrolet') || l.includes('gm')) return 'chevrolet';
  if (l.includes('volkswagen') || l.includes('vw')) return 'volkswagen';
  return slugify(marca.replace(/^(gm\s*-\s*|vw\s*-\s*)/i, ''));
}

export function veiculoId(marca: string, modeloNome: string, ano: number | string): string {
  return `${marcaSlug(marca)}-${slugify(modeloNome)}-${ano}`;
}

export function veiculoSlug(marca: string, modeloNome: string, ano: number | string): string {
  return veiculoId(marca, modeloNome, ano);
}

/** Slug da pasta do modelo (familia FIPE). */
export function modeloSlug(modelo: string): string {
  const base = modelo
    .replace(/\s+\d[\d.,]*\s*.*/i, '')
    .replace(/\s+(flex|diesel|gasolina|hibrido|hybrid|aut|manual).*$/i, '')
    .trim();
  return slugify(base || modelo);
}
