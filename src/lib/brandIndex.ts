import type { BrandSearchItem, FamilySearchItem } from '../types';

function brandDisplayName(marca: string, slug: string): string {
  if (slug === 'volkswagen') return 'Volkswagen';
  if (slug === 'chevrolet') return 'Chevrolet';
  const cleaned = marca.replace(/^(gm|vw)\s*-\s*/i, '').trim();
  return cleaned || marca;
}

export function buildBrandsFromFamilies(families: FamilySearchItem[]): BrandSearchItem[] {
  const map = new Map<string, BrandSearchItem>();

  for (const family of families) {
    const key = `${family.tipo}|${family.marcaSlug}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        slug: family.marcaSlug,
        nome: brandDisplayName(family.marca, family.marcaSlug),
        tipo: family.tipo,
        familyCount: 1,
        vehicleCount: family.versaoCount,
        hubPath: `/marca/${family.marcaSlug}`,
      });
      continue;
    }
    existing.familyCount += 1;
    existing.vehicleCount += family.versaoCount;
  }

  return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
