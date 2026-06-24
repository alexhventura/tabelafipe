/**
 * Proveniência e scores de confiança para campos do bundle.
 */
export const CONFIDENCE = {
  OFFICIAL: 100,
  OEM_MANUAL: 95,
  INMETRO_EXACT: 95,
  INMETRO_TRIM: 85,
  INMETRO_FAMILY: 70,
  LATIN_NCAP: 95,
  FIPE: 100,
  ENGINE_PROPAGATION: 80,
  PLATFORM_PROPAGATION: 70,
  SPECS_MASTER: 75,
  INFERENCE: 50,
} as const;

export interface FieldProvenance {
  value: string | number | boolean | null;
  source: string;
  origin?: string;
  sourceYear?: number;
  confidence: number;
  sourceUrl?: string;
  lastVerified?: string;
  matchedBy?: string;
  estimated?: boolean;
}

export type BundleProvenance = Record<string, FieldProvenance>;

export type ConfidenceLabel = 'Muito alta' | 'Alta' | 'Média' | 'Baixa';

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 90) return 'Muito alta';
  if (score >= 75) return 'Alta';
  if (score >= 55) return 'Média';
  return 'Baixa';
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const INMETRO_PBEV_URL =
  'https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem-veicular';

export function pbevOrigin(edicaoId?: string, anoReferencia?: number): string {
  if (edicaoId) return `PBEV (${edicaoId.replace(/^pbev-?/i, '').replace(/-/g, ' ')})`;
  if (anoReferencia) return `PBEV ${anoReferencia}`;
  return 'Programa Brasileiro de Etiquetagem Veicular (PBEV/INMETRO)';
}

export function metodoToConfidence(metodo?: string, fonte?: string): number {
  const m = (metodo ?? '').toLowerCase();
  const f = (fonte ?? '').toLowerCase();
  if (m.includes('oficial') || f.includes('manufacturer') || f.includes('fabricante')) return CONFIDENCE.OEM_MANUAL;
  if (m.includes('inmetro') || m.includes('pbev')) return CONFIDENCE.INMETRO_EXACT;
  if (m.includes('engine') || m.includes('motor')) return CONFIDENCE.ENGINE_PROPAGATION;
  if (m.includes('platform') || m.includes('plataforma')) return CONFIDENCE.PLATFORM_PROPAGATION;
  if (m.includes('infer')) return CONFIDENCE.INFERENCE;
  if (m.includes('static') || m.includes('catalog')) return CONFIDENCE.SPECS_MASTER;
  return CONFIDENCE.SPECS_MASTER;
}
