import type { VehiclePageBundle } from '../types/bundle';
import { formatDisplayNumber, isEmptyDisplayValue } from './display';
import {
  consumoMetricProfile,
  fuelCategoryLabel,
  isLikelyEtanolKmPerL,
  isLikelyKmPerKwh,
  isLikelyKwhPerKm,
  normalizeFuelType,
  showsElectricMetrics,
  showsLiquidFuelMetrics,
} from './fuelType';

export interface ConsumoRow {
  label: string;
  value: string;
}

function row(label: string, value: unknown, suffix: string): ConsumoRow | null {
  const formatted = formatDisplayNumber(value, { suffix });
  if (!formatted) return null;
  return { label, value: formatted };
}

function inmetroBlock(bundle: VehiclePageBundle): Record<string, unknown> | null {
  const im = bundle.inmetro;
  return im && typeof im === 'object' ? (im as Record<string, unknown>) : null;
}

export function buildConsumoRows(bundle: VehiclePageBundle): ConsumoRow[] {
  const inmetro = inmetroBlock(bundle);
  if (!inmetro) return [];

  const fuelCat = normalizeFuelType(bundle.identity.combustivel);
  const profile = consumoMetricProfile(bundle.identity.combustivel);
  const rows: ConsumoRow[] = [];

  const cidade = inmetro.consumoCidade as number | undefined;
  const estrada = inmetro.consumoEstrada as number | undefined;
  const cidadeAlt = inmetro.consumoCidadeEtanol as number | undefined;
  const estradaAlt = inmetro.consumoEstradaEtanol as number | undefined;

  if (profile === 'eletrico') {
    if (!isEmptyDisplayValue(cidade) && isLikelyKmPerKwh(cidade!)) {
      rows.push(...[row('Eficiência energética (cidade)', cidade, 'km/kWh')].filter(Boolean) as ConsumoRow[]);
    } else if (!isEmptyDisplayValue(cidade)) {
      rows.push(...[row('Eficiência energética (cidade)', cidade, 'km/kWh')].filter(Boolean) as ConsumoRow[]);
    }
    if (!isEmptyDisplayValue(estrada)) {
      rows.push(...[row('Eficiência energética (estrada)', estrada, 'km/kWh')].filter(Boolean) as ConsumoRow[]);
    }
    if (!isEmptyDisplayValue(cidadeAlt) && isLikelyKwhPerKm(cidadeAlt!)) {
      rows.push(...[row('Consumo energético (cidade)', cidadeAlt, 'kWh/km')].filter(Boolean) as ConsumoRow[]);
    }
    if (!isEmptyDisplayValue(estradaAlt) && isLikelyKwhPerKm(estradaAlt!)) {
      rows.push(...[row('Consumo energético (estrada)', estradaAlt, 'kWh/km')].filter(Boolean) as ConsumoRow[]);
    }
  } else if (profile === 'hibrido') {
    if (!isEmptyDisplayValue(cidade)) {
      rows.push(...[row('Gasolina (cidade)', cidade, 'km/l')].filter(Boolean) as ConsumoRow[]);
    }
    if (!isEmptyDisplayValue(estrada)) {
      rows.push(...[row('Gasolina (estrada)', estrada, 'km/l')].filter(Boolean) as ConsumoRow[]);
    }
    if (!isEmptyDisplayValue(cidadeAlt) && isLikelyKmPerKwh(cidadeAlt!)) {
      rows.push(...[row('Eficiência elétrica (cidade)', cidadeAlt, 'km/kWh')].filter(Boolean) as ConsumoRow[]);
    }
    if (!isEmptyDisplayValue(estradaAlt) && isLikelyKmPerKwh(estradaAlt!)) {
      rows.push(...[row('Eficiência elétrica (estrada)', estradaAlt, 'km/kWh')].filter(Boolean) as ConsumoRow[]);
    }
  } else {
    const fuelLabel = fuelCategoryLabel(fuelCat);
    if (!isEmptyDisplayValue(cidade)) {
      rows.push(...[row(`Cidade (${fuelLabel.toLowerCase()})`, cidade, 'km/l')].filter(Boolean) as ConsumoRow[]);
    }
    if (!isEmptyDisplayValue(estrada)) {
      rows.push(...[row(`Estrada (${fuelLabel.toLowerCase()})`, estrada, 'km/l')].filter(Boolean) as ConsumoRow[]);
    }
    if (fuelCat === 'flex' || fuelCat === 'unknown') {
      if (!isEmptyDisplayValue(cidadeAlt) && isLikelyEtanolKmPerL(cidadeAlt!)) {
        rows.push(...[row('Cidade (etanol)', cidadeAlt, 'km/l')].filter(Boolean) as ConsumoRow[]);
      }
      if (!isEmptyDisplayValue(estradaAlt) && isLikelyEtanolKmPerL(estradaAlt!)) {
        rows.push(...[row('Estrada (etanol)', estradaAlt, 'km/l')].filter(Boolean) as ConsumoRow[]);
      }
    }
  }

  if (inmetro.classificacaoEnergetica) {
    rows.push({
      label: 'Classificação INMETRO',
      value: String(inmetro.classificacaoEnergetica),
    });
  }

  if (showsLiquidFuelMetrics(fuelCat) && profile !== 'eletrico') {
    rows.push({ label: 'Combustível', value: fuelCategoryLabel(fuelCat) });
  } else if (showsElectricMetrics(fuelCat)) {
    rows.push({ label: 'Propulsão', value: fuelCategoryLabel(fuelCat) });
  }

  return rows;
}

/** Texto resumido de consumo para cards/FAQ — nunca mostra gasolina em elétrico puro. */
export function formatConsumoResumo(bundle: VehiclePageBundle): string | null {
  const rows = buildConsumoRows(bundle);
  if (!rows.length) return null;
  const main = rows.find((r) => r.label.includes('Cidade') || r.label.includes('cidade') || r.label.includes('Eficiência'));
  return main ? `${main.label}: ${main.value}` : null;
}

/** Detecta se bundle elétrico exibe métricas de combustível líquido (bug). */
export function hasElectricLiquidFuelBug(bundle: VehiclePageBundle): boolean {
  const cat = normalizeFuelType(bundle.identity.combustivel);
  if (cat !== 'eletrico') return false;
  const inmetro = inmetroBlock(bundle);
  if (!inmetro) return false;
  const rows = buildConsumoRows(bundle);
  return rows.some((r) => /gasolina|etanol|diesel/i.test(r.label));
}
