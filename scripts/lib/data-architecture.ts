/**
 * Arquitetura de dados — enciclopedia veicular offline.
 * Modelo canonico: 18 camadas (schema JSON) + 3 tiers de armazenamento.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PATHS } from './fipe-paths.js';

export type DataTier = 'permanente' | 'semi_dinamico' | 'dinamico';

export type EncyclopediaLayerId = string;
export type AcquisitionMethod =
  | 'fonte_direta'
  | 'fipe_inferido'
  | 'propagacao_geracao'
  | 'propagacao_familia'
  | 'derivado'
  | 'manual';

export interface EncyclopediaFieldDef {
  id: string;
  label: string;
  layer: EncyclopediaLayerId;
  tier: DataTier;
  fontes: string[];
  confiabilidade: 'alta' | 'media' | 'baixa';
  metaCoberturaPct?: number;
  pesoRelevancia?: number;
  reportKey?: string;
  descricao: string;
}

export interface EncyclopediaLayerDef {
  id: EncyclopediaLayerId;
  numero: number;
  titulo: string;
  descricao: string;
  campos: EncyclopediaFieldDef[];
}

interface EncyclopediaSchemaRoot {
  layers: EncyclopediaLayerDef[];
  prioritySources: string[];
}

const ENCYCLOPEDIA_SCHEMA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/schemas/encyclopedia-layers.schema.json',
);

let _encyclopediaCache: EncyclopediaSchemaRoot | null = null;

export function loadEncyclopediaSchema(): EncyclopediaSchemaRoot {
  if (!_encyclopediaCache) {
    const buf = fs.readFileSync(ENCYCLOPEDIA_SCHEMA_PATH);
    const text =
      buf[0] === 0xff && buf[1] === 0xfe
        ? buf.toString('utf16le').slice(1)
        : buf.includes(0)
          ? buf.toString('utf16le')
          : buf.toString('utf-8');
    _encyclopediaCache = JSON.parse(text) as EncyclopediaSchemaRoot;
  }
  return _encyclopediaCache;
}

export const ENCYCLOPEDIA_LAYERS = loadEncyclopediaSchema().layers;
export const ALL_ENCYCLOPEDIA_FIELDS = ENCYCLOPEDIA_LAYERS.flatMap((l) => l.campos);
export const PRIORITY_SOURCES = loadEncyclopediaSchema().prioritySources;

export function fieldsByLayer(layerId: EncyclopediaLayerId): EncyclopediaFieldDef[] {
  return ALL_ENCYCLOPEDIA_FIELDS.filter((f) => f.layer === layerId);
}

export function fieldById(id: string): EncyclopediaFieldDef | undefined {
  return ALL_ENCYCLOPEDIA_FIELDS.find((f) => f.id === id);
}

/** Fontes prioritarias e adapters built-in (registro modular). */
export const BUILTIN_SOURCE_ADAPTERS = [
  { id: 'fipe', nome: 'FIPE', prioridade: 1, camadas: ['identidade', 'precos'] },
  { id: 'fipex', nome: 'fipeX', prioridade: 2, camadas: ['precos', 'knowledge_graph'] },
  { id: 'inmetro_pbev', nome: 'INMETRO PBEV', prioridade: 3, camadas: ['consumo_eficiencia'] },
  { id: 'manufacturer', nome: 'Fabricantes', prioridade: 4, camadas: ['motorizacao', 'transmissao', 'dimensoes', 'capacidades'] },
  { id: 'latin_ncap', nome: 'Latin NCAP', prioridade: 5, camadas: ['seguranca'] },
  { id: 'senatran_recalls', nome: 'Senatran', prioridade: 6, camadas: ['recalls'] },
  { id: 'manual', nome: 'Manuais', prioridade: 7, camadas: ['manutencao', 'revisoes', 'rodas_pneus'] },
  { id: 'generations_catalog', nome: 'Geracoes', prioridade: 8, camadas: ['identidade', 'historia_automotiva'] },
  { id: 'derived', nome: 'Derivados', prioridade: 9, camadas: ['dados_derivados', 'knowledge_graph'] },
] as const;

export interface DataFieldDef {
  id: string;
  label: string;
  tier: DataTier;
  fontes: string[];
  confiabilidade: 'alta' | 'media' | 'baixa';
  reportKey?: string;
  descricao: string;
  metaCoberturaPct?: number;
}

export const DATA_TIERS: Record<DataTier, { id: DataTier; label: string; cadencia: string; descricao: string }> = {
  permanente: { id: 'permanente', label: 'Permanente', cadencia: 'captura unica, versionada', descricao: 'Specs tecnicas estaveis. Imutaveis por ano-modelo.' },
  semi_dinamico: { id: 'semi_dinamico', label: 'Semi-dinamico', cadencia: 'trimestral / semestral', descricao: 'Roubo, seguro, recalls.' },
  dinamico: { id: 'dinamico', label: 'Dinamico', cadencia: 'mensal', descricao: 'FIPE, historico, tendencias, liquidez.' },
};

export const PERMANENT_SPEC_FIELDS: DataFieldDef[] = [
  { id: 'potencia', label: 'Potencia', tier: 'permanente', fontes: ['FABRICANTE'], confiabilidade: 'alta', reportKey: 'potencia_cv', descricao: 'Potencia maxima (cv).', metaCoberturaPct: 60 },
  { id: 'torque', label: 'Torque', tier: 'permanente', fontes: ['FABRICANTE'], confiabilidade: 'alta', descricao: 'Torque maximo (Nm).', metaCoberturaPct: 50 },
  { id: 'cilindrada', label: 'Cilindrada', tier: 'permanente', fontes: ['FABRICANTE'], confiabilidade: 'alta', reportKey: 'cilindrada_cc', descricao: 'Cilindrada (cc).', metaCoberturaPct: 60 },
  { id: 'consumo', label: 'Consumo', tier: 'permanente', fontes: ['INMETRO/PBEV'], confiabilidade: 'alta', reportKey: 'consumo_cidade', descricao: 'Consumo homologado INMETRO.', metaCoberturaPct: 40 },
  { id: 'classificacao_energetica', label: 'Classificacao energetica', tier: 'permanente', fontes: ['INMETRO/PBEV'], confiabilidade: 'alta', descricao: 'Selo PBE (A-G).', metaCoberturaPct: 40 },
  { id: 'cambio', label: 'Cambio', tier: 'permanente', fontes: ['FABRICANTE'], confiabilidade: 'alta', reportKey: 'cambio', descricao: 'Transmissao.', metaCoberturaPct: 50 },
  { id: 'peso', label: 'Peso', tier: 'permanente', fontes: ['FABRICANTE'], confiabilidade: 'media', descricao: 'Peso (kg).', metaCoberturaPct: 40 },
  { id: 'dimensoes', label: 'Dimensoes', tier: 'permanente', fontes: ['FABRICANTE'], confiabilidade: 'media', descricao: 'C/L/A (mm).', metaCoberturaPct: 35 },
  { id: 'porta_malas', label: 'Porta-malas', tier: 'permanente', fontes: ['FABRICANTE'], confiabilidade: 'media', descricao: 'Volume (L).', metaCoberturaPct: 35 },
  { id: 'tanque', label: 'Tanque', tier: 'permanente', fontes: ['FABRICANTE'], confiabilidade: 'media', descricao: 'Capacidade (L).', metaCoberturaPct: 35 },
  { id: 'fotos', label: 'Fotos', tier: 'permanente', fontes: ['FABRICANTE'], confiabilidade: 'media', descricao: 'Imagem representativa.', metaCoberturaPct: 20 },
];

export const PERIODIC_FIELDS: DataFieldDef[] = [
  { id: 'roubo', label: 'Roubo/furto', tier: 'semi_dinamico', fontes: ['CNseg'], confiabilidade: 'media', descricao: 'Muito visado | Visado | Medio | Pouco visado', metaCoberturaPct: 30 },
  { id: 'seguro', label: 'Faixa seguro', tier: 'semi_dinamico', fontes: ['CNseg'], confiabilidade: 'media', descricao: 'Baixa | Media | Alta | Muito alta', metaCoberturaPct: 25 },
  { id: 'recalls', label: 'Recalls', tier: 'semi_dinamico', fontes: ['SENATRAN'], confiabilidade: 'alta', descricao: 'Campanhas recall.', metaCoberturaPct: 40 },
  { id: 'seguranca_ncap', label: 'Seguranca NCAP', tier: 'semi_dinamico', fontes: ['LATIN-NCAP'], confiabilidade: 'alta', descricao: 'Notas Latin NCAP.', metaCoberturaPct: 40 },
  { id: 'garantia', label: 'Garantia fabrica', tier: 'semi_dinamico', fontes: ['FABRICANTE'], confiabilidade: 'alta', descricao: 'Garantia total e anticorrosao.', metaCoberturaPct: 30 },
  { id: 'manutencao', label: 'Manutencao', tier: 'semi_dinamico', fontes: ['DERIVED'], confiabilidade: 'baixa', descricao: 'Custo estimado.', metaCoberturaPct: 20 },
];

export const MONTHLY_FIELDS: DataFieldDef[] = [
  { id: 'valor_fipe', label: 'Valor FIPE', tier: 'dinamico', fontes: ['FIPE'], confiabilidade: 'alta', reportKey: 'valor_fipe', descricao: 'Preco mes corrente.', metaCoberturaPct: 100 },
  { id: 'historico', label: 'Historico', tier: 'dinamico', fontes: ['fipeX'], confiabilidade: 'alta', reportKey: 'historico_precos', descricao: 'Serie mensal.', metaCoberturaPct: 100 },
  { id: 'tendencia', label: 'Tendencia', tier: 'dinamico', fontes: ['DERIVED'], confiabilidade: 'media', descricao: 'Variacao 12m.', metaCoberturaPct: 80 },
  { id: 'desvalorizacao', label: 'Desvalorizacao', tier: 'dinamico', fontes: ['DERIVED'], confiabilidade: 'media', descricao: 'Depreciacao anual.', metaCoberturaPct: 80 },
  { id: 'liquidez', label: 'Liquidez', tier: 'dinamico', fontes: ['DERIVED'], confiabilidade: 'baixa', descricao: 'Revenda.', metaCoberturaPct: 30 },
  { id: 'posicao_mercado', label: 'Posicao segmento', tier: 'dinamico', fontes: ['DERIVED'], confiabilidade: 'media', descricao: 'Percentil preco.', metaCoberturaPct: 70 },
];

export const ALL_DATA_FIELDS = [...PERMANENT_SPEC_FIELDS, ...PERIODIC_FIELDS, ...MONTHLY_FIELDS];

export interface VehiclePageSection { id: string; titulo: string; campos: string[]; ordem: number; tier: DataTier; }

export const VEHICLE_PAGE_SECTIONS: VehiclePageSection[] = [
  { id: 'resumo', titulo: 'Valor de Mercado', campos: ['valor_fipe', 'historico', 'tendencia', 'desvalorizacao'], ordem: 1, tier: 'dinamico' },
  { id: 'specs_motor', titulo: 'Ficha Tecnica — Motor', campos: ['potencia', 'torque', 'cilindrada', 'cambio'], ordem: 2, tier: 'permanente' },
  { id: 'specs_consumo', titulo: 'Consumo e Eficiencia', campos: ['consumo', 'classificacao_energetica'], ordem: 3, tier: 'permanente' },
  { id: 'specs_dimensoes', titulo: 'Dimensoes', campos: ['peso', 'dimensoes', 'porta_malas', 'tanque'], ordem: 4, tier: 'permanente' },
  { id: 'indicadores', titulo: 'Indicadores', campos: ['manutencao', 'seguro', 'roubo', 'liquidez'], ordem: 5, tier: 'semi_dinamico' },
  { id: 'comparativos', titulo: 'Comparativos', campos: ['posicao_mercado'], ordem: 6, tier: 'dinamico' },
  { id: 'evolucao', titulo: 'Evolucao', campos: ['historico'], ordem: 7, tier: 'dinamico' },
];

export const UX_PRINCIPLES = [
  'Resposta imediata (<3s): foto + FIPE + consumo + potencia no hero.',
  'Escaneavel: blocos curtos, secoes colapsaveis, mobile-first.',
  'Busca tolerante: civic, civc, sentra 2017 — fuzzy match.',
  'Fonte visivel em cada dado (FIPE, INMETRO, fabricante).',
  'Ocultar blocos vazios — simplicidade FIPE.',
  'Zero dados inventados.',
] as const;

export const STORAGE_PATHS = {
  staticRoot: 'data/static',
  staticSpecs: 'data/static/specs',
  staticSpecsManifest: 'data/static/specs/manifest.json',
  staticSpecsSchema: 'data/schemas/static-vehicle-specs.schema.json',
  periodicRoot: 'data/periodic',
  periodicManifest: 'data/periodic/manifest.json',
  monthlyRoot: 'data/monthly',
  monthlyManifest: 'data/monthly/manifest.json',
  reportsRoot: 'data/reports',
  vehicleEncyclopediaRoadmap: 'data/reports/vehicle-encyclopedia-roadmap.json',
  coverageEnrichmentReport: PATHS.coverageEnrichmentReport,
  fieldQualityReport: PATHS.fieldQualityReport,
  enrichmentSummary: PATHS.reportsRoot + '/enrichment-summary.json',
} as const;