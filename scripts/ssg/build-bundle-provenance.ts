import type { InmetroData, RecallData, SafetyData, SpecsData, WarrantyData } from '../lib/enrichment/types.js';
import {
  CONFIDENCE,
  INMETRO_PBEV_URL,
  type BundleProvenance,
  metodoToConfidence,
  pbevOrigin,
  todayIso,
} from '../lib/provenance.js';

interface BuildProvenanceInput {
  valorAtual: number;
  mesReferencia: string;
  specs: SpecsData | null;
  inmetro: InmetroData | null;
  safety: SafetyData | null;
  recalls: RecallData | null;
  warranty: WarrantyData | null;
  engineEntity: Record<string, unknown> | null;
  specRec: Record<string, unknown> | null | undefined;
  combustivel: string;
}

function sourceLabelFromFonte(fonte?: string | null): string {
  if (!fonte) return 'Catálogo técnico';
  const f = fonte.toLowerCase();
  if (f.includes('manufacturer') || f.includes('fabricante')) return 'Fabricante';
  if (f.includes('inmetro') || f.includes('pbev')) return 'INMETRO';
  if (f.includes('static')) return 'Catálogo estático';
  return fonte;
}

export function buildBundleProvenance(input: BuildProvenanceInput): BundleProvenance {
  const today = todayIso();
  const prov: BundleProvenance = {};

  if (input.valorAtual > 0) {
    prov.valorFipe = {
      value: input.valorAtual,
      source: 'FIPE',
      origin: `Tabela FIPE (${input.mesReferencia})`,
      confidence: CONFIDENCE.FIPE,
      lastVerified: today,
    };
  }

  if (input.inmetro) {
    const im = input.inmetro;
    const origin = pbevOrigin(im.edicaoId, im.anoReferencia ?? undefined);
    const conf = im.confidence ?? CONFIDENCE.INMETRO_EXACT;
    const base = {
      source: 'INMETRO',
      origin,
      sourceYear: im.anoReferencia ?? undefined,
      confidence: conf,
      sourceUrl: INMETRO_PBEV_URL,
      lastVerified: today,
      matchedBy: im.matchedBy,
      estimated: im.matchTier === 'family_prefix',
    };

    if (im.consumoCidade != null) prov.consumoCidade = { value: im.consumoCidade, ...base };
    if (im.consumoEstrada != null) prov.consumoEstrada = { value: im.consumoEstrada, ...base };
    if (im.classificacaoEnergetica) {
      prov.classificacaoEnergetica = { value: im.classificacaoEnergetica, ...base };
    }
  }

  const specs = input.specs;
  const specRec = input.specRec;
  const specFonte = (specs?.fonte as string | undefined) ?? (specRec?.fonte as string | undefined);
  const specMetodo = specRec?.metodo as string | undefined;
  const specConf =
    typeof specRec?.confidence === 'number'
      ? Math.round((specRec.confidence as number) * 100)
      : metodoToConfidence(specMetodo, specFonte);

  if (specs?.potenciaCv != null) {
    prov.potenciaCv = {
      value: specs.potenciaCv,
      source: sourceLabelFromFonte(specFonte),
      origin: specMetodo ? String(specMetodo) : 'Ficha técnica',
      confidence: specConf,
      lastVerified: today,
    };
  } else if (input.engineEntity?.potencia != null) {
    prov.potenciaCv = {
      value: input.engineEntity.potencia as number,
      source: 'Engine Master',
      origin: 'Propagado por motorização equivalente',
      confidence: CONFIDENCE.ENGINE_PROPAGATION,
      lastVerified: today,
      estimated: true,
      matchedBy: 'engine_graph',
    };
  }

  if (specs?.torqueNm != null) {
    prov.torqueNm = {
      value: specs.torqueNm,
      source: sourceLabelFromFonte(specFonte),
      origin: specMetodo ? String(specMetodo) : 'Ficha técnica',
      confidence: specConf,
      lastVerified: today,
    };
  } else if (input.engineEntity?.torqueNm != null) {
    prov.torqueNm = {
      value: input.engineEntity.torqueNm as number,
      source: 'Engine Master',
      origin: 'Propagado por motorização equivalente',
      confidence: CONFIDENCE.ENGINE_PROPAGATION,
      lastVerified: today,
      estimated: true,
      matchedBy: 'engine_graph',
    };
  }

  if (specs?.cambio) {
    prov.cambio = {
      value: specs.cambio,
      source: sourceLabelFromFonte(specFonte),
      confidence: specConf,
      lastVerified: today,
    };
  }

  if (input.safety?.notaGeral != null) {
    prov.notaGeral = {
      value: input.safety.notaGeral,
      source: 'Latin NCAP',
      origin: input.safety.dataTeste ? `Teste ${input.safety.dataTeste}` : 'Latin NCAP',
      confidence: CONFIDENCE.LATIN_NCAP,
      lastVerified: today,
    };
  }

  if (input.warranty?.garantiaTotalAnos != null) {
    prov.garantia = {
      value: input.warranty.garantiaTotalAnos,
      source: sourceLabelFromFonte(input.warranty.fonte),
      origin: 'Política de garantia do fabricante',
      confidence: CONFIDENCE.OEM_MANUAL,
      lastVerified: today,
    };
  }

  if (input.recalls?.total != null && input.recalls.total > 0) {
    prov.recalls = {
      value: input.recalls.total,
      source: 'Campanhas oficiais',
      origin: 'Registros públicos de recall',
      confidence: CONFIDENCE.OFFICIAL,
      lastVerified: today,
    };
  }

  return prov;
}
