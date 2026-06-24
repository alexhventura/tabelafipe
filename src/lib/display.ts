/**
 * Camada de formatação para exibição ao usuário.
 * Nenhum valor bruto deve ir direto para a UI sem passar por aqui.
 */
import { formatYearLabel, resolveDisplayYear } from './displayYear';

const JUNK_IN_PARENS = /\s*\((null|undefined|nan|0)\)\s*/gi;
const EMPTY_PARENS = /\s*\(\s*\)\s*/g;
const MULTI_SPACE = /\s{2,}/g;

/** Valores que não devem ser exibidos ao usuário. */
export function isEmptyDisplayValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'number') return Number.isNaN(value) || value === 0;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s === '' || s === 'null' || s === 'undefined' || s === 'nan' || s === '0';
  }
  return false;
}

/** Remove artefatos como (null), (undefined), (NaN), (0) de textos. */
export function sanitizeDisplayText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(JUNK_IN_PARENS, ' ')
    .replace(EMPTY_PARENS, ' ')
    .replace(MULTI_SPACE, ' ')
    .trim();
}

/** Formata número para exibição; retorna vazio se inválido. */
export function formatDisplayNumber(
  value: unknown,
  opts?: { decimals?: number; suffix?: string },
): string {
  if (isEmptyDisplayValue(value)) return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  const decimals = opts?.decimals ?? (Number.isInteger(n) ? 0 : 1);
  const formatted = n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return opts?.suffix ? `${formatted} ${opts.suffix}` : formatted;
}

export interface VehicleYearInput {
  displayYear?: { label: string; kind: string };
  anoModelo?: number | null;
  ano?: number | null;
}

/** Rótulo de ano para UI: "2024", "0 km" ou vazio. */
export function formatVehicleYear(vehicle: VehicleYearInput): string {
  if (vehicle.displayYear?.label) return vehicle.displayYear.label;
  return formatYearLabel(vehicle.anoModelo ?? vehicle.ano);
}

/** Título com ano: "Corolla XEi 2024", "BYD King GL Híbrido 0 km". */
export function formatVehicleTitle(displayName: string, vehicle: VehicleYearInput): string {
  const name = sanitizeDisplayText(displayName);
  if (!name) return '';
  const year = formatVehicleYear(vehicle);
  if (!year) return name;
  const lower = name.toLowerCase();
  if (lower.includes(year.toLowerCase())) return name;
  const d = resolveDisplayYear(vehicle.anoModelo ?? vehicle.ano);
  if (d.kind === 'year' && d.year && lower.includes(String(d.year))) return name;
  return `${name} ${year}`.trim();
}

/** Nome de exibição limpo (sem sufixos inválidos de ano). */
export function formatVehicleDisplayName(
  marca: string,
  modelo: string,
  nomeHistorico?: string | null,
): string {
  const raw = nomeHistorico
    ? sanitizeDisplayText(nomeHistorico.replace(/\s*\(\d{4}\)\s*$/, '').trim())
    : `${marca} ${modelo}`.trim();
  return sanitizeDisplayText(raw) || `${marca} ${modelo}`.trim();
}
