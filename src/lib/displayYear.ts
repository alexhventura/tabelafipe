/** Normalização e exibição de ano modelo (FIPE). */

export type DisplayYearKind = 'year' | 'zero_km' | 'hidden';

export interface DisplayYear {
  kind: DisplayYearKind;
  /** Ano calendário quando kind === 'year' */
  year?: number;
  /** Rótulo para o usuário: "2024", "0 km" ou vazio */
  label: string;
  shortLabel: string;
}

const ZERO_KM_VALUES = new Set([0, '0', 32000, '32000']);

function isNullishRaw(raw: unknown): boolean {
  if (raw == null) return true;
  const s = String(raw).trim().toLowerCase();
  return s === '' || s === 'null' || s === 'undefined' || s === 'nan';
}

/** Converte valor bruto FIPE/importação em ano numérico, 0 (zero km) ou null. */
export function normalizeAnoModelo(raw: unknown): number | null {
  if (isNullishRaw(raw)) return null;
  if (ZERO_KM_VALUES.has(raw as string | number)) return 0;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return 0;
  if (n >= 1900 && n <= 2100) return n;
  return null;
}

export function resolveDisplayYear(raw: unknown): DisplayYear {
  const normalized = normalizeAnoModelo(raw);
  if (normalized === 0) {
    return { kind: 'zero_km', label: '0 km', shortLabel: '0 km' };
  }
  if (normalized == null) {
    return { kind: 'hidden', label: '', shortLabel: '' };
  }
  const year = normalized;
  return { kind: 'year', year, label: String(year), shortLabel: String(year) };
}

/** Texto de ano para UI; retorna vazio quando não há ano a exibir. */
export function formatYearLabel(raw: unknown): string {
  return resolveDisplayYear(raw).label;
}

/** "Ano 2024" ou "0 km"; vazio se oculto. */
export function formatYearWithPrefix(raw: unknown, prefix = 'Ano'): string {
  const d = resolveDisplayYear(raw);
  if (d.kind === 'hidden') return '';
  if (d.kind === 'zero_km') return d.label;
  return `${prefix} ${d.label}`.trim();
}

/** Anexa ano ao nome se ainda não estiver presente. */
export function appendYearToTitle(title: string, raw: unknown): string {
  const d = resolveDisplayYear(raw);
  if (d.kind === 'hidden') return title;
  const part = d.label;
  const lower = title.toLowerCase();
  if (lower.includes(part.toLowerCase())) return title;
  if (d.kind === 'year' && lower.includes(String(d.year))) return title;
  return `${title} ${part}`.trim();
}

export function hasDisplayableYear(raw: unknown): boolean {
  return resolveDisplayYear(raw).kind !== 'hidden';
}

/** Evita exibir "0", "null", "undefined" ou "NaN" na interface. */
export function sanitizeYearForDisplay(value: unknown): string {
  const label = formatYearLabel(value);
  if (!label) return '';
  const lower = String(value).trim().toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'nan') return label;
  return label;
}

export function getIdentityDisplayYear(identity: {
  displayYear?: import('../types/bundle').DisplayYear;
  anoModelo?: number | null;
  ano?: number | null;
}): import('../types/bundle').DisplayYear {
  if (identity.displayYear) return identity.displayYear;
  return resolveDisplayYear(identity.anoModelo ?? identity.ano);
}

export function formatRelatedYear(link: { ano?: number; displayYear?: import('../types/bundle').DisplayYear }): string {
  if (link.displayYear?.label) return link.displayYear.label;
  return formatYearLabel(link.ano);
}
