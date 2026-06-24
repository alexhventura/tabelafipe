import type { VehiclePageBundle } from '../types/bundle';

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

export interface ProvenanceDisplayRow {
  field: string;
  label: string;
  source: string;
  origin?: string;
  confidence: ConfidenceLabel;
  estimated?: boolean;
  note?: string;
}

const FIELD_LABELS: Record<string, string> = {
  valorFipe: 'Preço FIPE',
  consumoCidade: 'Consumo cidade',
  consumoEstrada: 'Consumo estrada',
  classificacaoEnergetica: 'Classificação INMETRO',
  potenciaCv: 'Potência',
  torqueNm: 'Torque',
  cambio: 'Transmissão',
  notaGeral: 'Latin NCAP',
};

export function getBundleProvenance(bundle: VehiclePageBundle): BundleProvenance | null {
  const p = bundle.provenance;
  return p && Object.keys(p).length > 0 ? p : null;
}

export function buildProvenanceDisplayRows(bundle: VehiclePageBundle): ProvenanceDisplayRow[] {
  const prov = getBundleProvenance(bundle);
  if (!prov) return [];

  const rows: ProvenanceDisplayRow[] = [];
  for (const [key, field] of Object.entries(prov)) {
    if (field.value == null || field.value === '') continue;
    let note: string | undefined;
    if (field.estimated) note = 'Estimado por motorização equivalente';
    else if (field.matchedBy?.startsWith('family:')) note = 'Herdado da família do modelo';
    else if (field.matchedBy?.startsWith('trim:')) note = 'Associado por versão (trim)';

    rows.push({
      field: key,
      label: FIELD_LABELS[key] ?? key,
      source: field.origin ? `${field.source} (${field.origin})` : field.source,
      origin: field.origin,
      confidence: confidenceLabel(field.confidence),
      estimated: field.estimated,
      note,
    });
  }
  return rows;
}

export function formatInmetroSourceLine(bundle: VehiclePageBundle): string | null {
  const prov = getBundleProvenance(bundle);
  const consumo = prov?.consumoCidade;
  if (consumo) {
    const year = consumo.sourceYear ? ` · Ano do levantamento: ${consumo.sourceYear}` : '';
    return `Fonte: ${consumo.origin ?? 'Programa Brasileiro de Etiquetagem Veicular (PBEV/INMETRO)'}${year}`;
  }
  const inmetro = bundle.inmetro as Record<string, unknown> | null;
  if (!inmetro?.consumoCidade && !inmetro?.consumoEstrada) return null;
  const ano = inmetro.anoReferencia as number | undefined;
  const year = ano ? ` · Ano do levantamento: ${ano}` : '';
  return `Fonte: Programa Brasileiro de Etiquetagem Veicular (PBEV/INMETRO)${year}`;
}
