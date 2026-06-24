/**
 * Camada de formatação para exibição ao usuário.
 * Nenhum valor bruto deve ir direto para a UI sem passar por aqui.
 */
import { formatYearLabel, resolveDisplayYear } from './displayYear';

const JUNK_IN_PARENS = /\s*\((null|undefined|nan|0)\)\s*/gi;
const EMPTY_PARENS = /\s*\(\s*\)\s*/g;
const MULTI_SPACE = /\s{2,}/g;

const LOWERCASE_PARTICLES = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'com', 'para', 'ou']);

const UPPERCASE_ACRONYMS = new Set([
  'bmw', 'byd', 'gm', 'gwm', 'jac', 'ram', 'mg', 'vm', 'suv', 'cd', 'tb', 'abs', 'cvt', 'mt', 'at',
  'hp', 'cv', 'km', 'fipe', 'tfsi', 'tsi', 'tdi', 'hdi', 'cdi', 'mpi', 'fsi', '4x4', '4wd', 'awd',
  'fwd', '2wd', 'phev', 'ev', 'hv', 'usb', 'gps', 'led', 'xre', 'sw4', 'hb20', 'cg', 'cb', 'pcx',
  'nmax', 'mt', 'am',
]);

const MIXED_VERSION_TOKENS: Record<string, string> = {
  xei: 'XEi',
  gli: 'GLi',
  xli: 'XLi',
  xls: 'XLS',
  gl: 'GL',
  gs: 'GS',
  lx: 'LX',
  ex: 'EX',
  dx: 'DX',
  rs: 'RS',
  gt: 'GT',
  xr: 'XR',
  hb: 'HB',
  le: 'LE',
  se: 'SE',
  si: 'SI',
  gls: 'GLS',
  glx: 'GLX',
  xrs: 'XRS',
  xlt: 'XLT',
  ltz: 'LTZ',
};

const KNOWN_BRAND_NAMES: Record<string, string> = {
  volkswagen: 'Volkswagen',
  chevrolet: 'Chevrolet',
  'mercedes-benz': 'Mercedes-Benz',
  'land-rover': 'Land Rover',
  'alfa-romeo': 'Alfa Romeo',
  'aston-martin': 'Aston Martin',
  'rolls-royce': 'Rolls-Royce',
  'am-gen': 'AM Gen',
  'asia-motors': 'Asia Motors',
  'kia-motors': 'Kia Motors',
  mini: 'Mini',
  fiat: 'Fiat',
  ford: 'Ford',
  honda: 'Honda',
  toyota: 'Toyota',
  hyundai: 'Hyundai',
  nissan: 'Nissan',
  peugeot: 'Peugeot',
  citroen: 'Citroën',
  renault: 'Renault',
  jeep: 'Jeep',
  volvo: 'Volvo',
  porsche: 'Porsche',
  ferrari: 'Ferrari',
  lamborghini: 'Lamborghini',
  'harley-davidson': 'Harley-Davidson',
};

export interface TitleCaseOptions {
  isBrand?: boolean;
  slug?: string;
}

function formatWordToken(word: string, isFirstWord: boolean): string {
  if (!word) return '';
  if (word.includes('.')) {
    return word
      .split('.')
      .map((segment, index) => (segment ? formatWordToken(segment, isFirstWord && index === 0) : ''))
      .join('.');
  }
  const lower = word.toLowerCase();
  if (MIXED_VERSION_TOKENS[lower]) return MIXED_VERSION_TOKENS[lower];
  if (UPPERCASE_ACRONYMS.has(lower)) return lower.toUpperCase();
  if (!isFirstWord && LOWERCASE_PARTICLES.has(lower)) return lower;

  if (/\d/.test(word)) {
    return word.replace(/([a-zA-Z]+)/g, (letters) => {
      const l = letters.toLowerCase();
      if (MIXED_VERSION_TOKENS[l]) return MIXED_VERSION_TOKENS[l];
      if (UPPERCASE_ACRONYMS.has(l)) return l.toUpperCase();
      return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
    });
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Primeira letra de cada palavra maiúscula; siglas e versões FIPE preservadas. */
export function formatTitleCase(text: string, opts: TitleCaseOptions = {}): string {
  const cleaned = sanitizeDisplayText(text);
  if (!cleaned) return '';

  if (opts.slug) {
    const known = KNOWN_BRAND_NAMES[opts.slug.toLowerCase()];
    if (known) return known;
  }

  if (opts.isBrand) {
    const stripped = cleaned.replace(/^(gm|vw)\s*-\s*/i, '').trim();
    if (opts.slug && KNOWN_BRAND_NAMES[opts.slug.toLowerCase()]) {
      return KNOWN_BRAND_NAMES[opts.slug.toLowerCase()];
    }
    return formatTitleCase(stripped || cleaned);
  }

  const parts = cleaned.split(/(\s+|\/|-)/);
  let wordIndex = 0;
  return parts
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === '-' || part === '/') return part;
      const out = formatWordToken(part, wordIndex === 0);
      if (part.trim()) wordIndex++;
      return out;
    })
    .join('')
    .replace(MULTI_SPACE, ' ')
    .trim();
}

export function formatBrandName(marca: string, slug?: string): string {
  if (slug && KNOWN_BRAND_NAMES[slug.toLowerCase()]) {
    return KNOWN_BRAND_NAMES[slug.toLowerCase()];
  }
  const stripped = marca.replace(/^(gm|vw)\s*-\s*/i, '').trim();
  return formatTitleCase(stripped || marca, { isBrand: true, slug });
}

/** Rótulo genérico para UI: sanitiza + title case. */
export function formatDisplayText(text: string | null | undefined, opts?: TitleCaseOptions): string {
  return formatTitleCase(sanitizeDisplayText(text), opts);
}

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
  const name = formatTitleCase(sanitizeDisplayText(displayName));
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
    ? nomeHistorico.replace(/\s*\(\d{4}\)\s*$/, '').trim()
    : `${marca} ${modelo}`.trim();
  const base = sanitizeDisplayText(raw) || `${marca} ${modelo}`.trim();
  return formatTitleCase(base);
}
