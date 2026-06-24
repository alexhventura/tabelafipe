/**
 * Normalização de combustível e regras de exibição de consumo.
 */

export type FuelCategory =
  | 'gasolina'
  | 'etanol'
  | 'flex'
  | 'diesel'
  | 'hibrido'
  | 'hibrido_plug_in'
  | 'eletrico'
  | 'gnv'
  | 'unknown';

export type ConsumoMetricProfile = 'combustao' | 'eletrico' | 'hibrido';

export function normalizeFuelType(combustivel: string | null | undefined): FuelCategory {
  const c = (combustivel ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!c.trim()) return 'unknown';
  if (c.includes('plug') || c.includes('phev')) return 'hibrido_plug_in';
  if (c.includes('eletr') || c.includes('electric')) return 'eletrico';
  if (c.includes('hibrid') || c.includes('hybrid')) return 'hibrido';
  if (c.includes('diesel')) return 'diesel';
  if (c.includes('gnv') || c.includes('gas natural')) return 'gnv';
  if (c.includes('flex') || c.includes('bicombust')) return 'flex';
  if (c.includes('etanol') || c.includes('alcool')) return 'etanol';
  if (c.includes('gasolina') || c === 'gas') return 'gasolina';
  return 'unknown';
}

export function consumoMetricProfile(combustivel: string | null | undefined): ConsumoMetricProfile {
  const cat = normalizeFuelType(combustivel);
  if (cat === 'eletrico') return 'eletrico';
  if (cat === 'hibrido' || cat === 'hibrido_plug_in') return 'hibrido';
  return 'combustao';
}

export function showsLiquidFuelMetrics(cat: FuelCategory): boolean {
  return ['gasolina', 'etanol', 'flex', 'diesel', 'gnv', 'unknown'].includes(cat)
    || cat === 'hibrido'
    || cat === 'hibrido_plug_in';
}

export function showsElectricMetrics(cat: FuelCategory): boolean {
  return cat === 'eletrico' || cat === 'hibrido' || cat === 'hibrido_plug_in';
}

/** Valores acima de 18 em PBEV para híbridos/elétricos = km/kWh, não etanol. */
export function isLikelyKmPerKwh(value: number): boolean {
  return value > 18;
}

/** Valores entre 0.15 e 1.2 em PBEV elétrico = kWh/km. */
export function isLikelyKwhPerKm(value: number): boolean {
  return value > 0 && value < 1.5;
}

/** Etanol km/l típico: 5–18. */
export function isLikelyEtanolKmPerL(value: number): boolean {
  return value >= 5 && value <= 18;
}

export function fuelCategoryLabel(cat: FuelCategory): string {
  switch (cat) {
    case 'gasolina': return 'Gasolina';
    case 'etanol': return 'Etanol';
    case 'flex': return 'Flex';
    case 'diesel': return 'Diesel';
    case 'hibrido': return 'Híbrido';
    case 'hibrido_plug_in': return 'Híbrido plug-in';
    case 'eletrico': return 'Elétrico';
    case 'gnv': return 'GNV';
    default: return 'Combustível';
  }
}
