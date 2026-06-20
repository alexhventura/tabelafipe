export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function marcaSlug(marca) {
  const l = String(marca).toLowerCase();
  if (l.includes('chevrolet') || l.includes('gm')) return 'chevrolet';
  if (l.includes('volkswagen') || l.includes('vw')) return 'volkswagen';
  return slugify(String(marca).replace(/^(gm\s*-\s*|vw\s*-\s*)/i, ''));
}

export function modeloSlug(modelo) {
  const base = String(modelo)
    .replace(/\s+\d[\d.,]*\s*.*/i, '')
    .replace(/\s+(flex|diesel|gasolina|hibrido|hybrid|aut|manual).*$/i, '')
    .trim();
  return slugify(base || modelo);
}
