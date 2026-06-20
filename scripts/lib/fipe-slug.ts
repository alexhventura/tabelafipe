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

/** Slug do combustivel para URLs unicas (ex: flex, gasolina, hibrido). */
export function combustivelSlug(combustivel: string): string {
  const c = combustivel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (c.includes('flex')) return 'flex';
  if (c.includes('diesel')) return 'diesel';
  if (c.includes('gasolina')) return 'gasolina';
  if (c.includes('hibrid') || c.includes('hybrid')) return 'hibrido';
  if (c.includes('eletr')) return 'eletrico';
  if (c.includes('gnv') || c.includes('gas natural')) return 'gnv';
  if (c.includes('alcool') || c.includes('etanol') || c.includes('álcool')) return 'etanol';
  return slugify(combustivel) || 'outro';
}

export function veiculoId(
  marca: string,
  modeloNome: string,
  ano: number | string,
  combustivel?: string,
): string {
  const fuel = combustivel ? combustivelSlug(combustivel) : 'flex';
  return `${marcaSlug(marca)}-${slugify(modeloNome)}-${ano}-${fuel}`;
}

/** Garante slug unico; usa sufixo FIPE apenas em colisao residual. */
export function veiculoIdUnique(
  marca: string,
  modeloNome: string,
  ano: number | string,
  combustivel: string,
  fipeCodigo: string,
  usedIds: Set<string>,
): string {
  let id = veiculoId(marca, modeloNome, ano, combustivel);
  if (!usedIds.has(id)) return id;
  const suffix = slugify(fipeCodigo);
  id = `${id}-${suffix}`;
  let n = 2;
  while (usedIds.has(id)) {
    id = `${veiculoId(marca, modeloNome, ano, combustivel)}-${suffix}-${n}`;
    n++;
  }
  return id;
}

export function veiculoSlug(
  marca: string,
  modeloNome: string,
  ano: number | string,
  combustivel?: string,
): string {
  return veiculoId(marca, modeloNome, ano, combustivel);
}

/** Slug da pasta do modelo (familia FIPE). */
export function modeloSlug(modelo: string): string {
  const base = modelo
    .replace(/\s+\d[\d.,]*\s*.*/i, '')
    .replace(/\s+(flex|diesel|gasolina|hibrido|hybrid|aut|manual).*$/i, '')
    .trim();
  return slugify(base || modelo);
}
