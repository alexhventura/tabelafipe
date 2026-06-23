/**
 * Gera data/reports/vehicle-encyclopedia-roadmap.json a partir dos relatorios de cobertura.
 */
import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';
import {
  ALL_DATA_FIELDS,
  DATA_TIERS,
  MONTHLY_FIELDS,
  PERIODIC_FIELDS,
  PERMANENT_SPEC_FIELDS,
  STORAGE_PATHS,
  UX_PRINCIPLES,
  VEHICLE_PAGE_SECTIONS,
  type DataFieldDef,
  type DataTier,
} from '../lib/data-architecture.js';

interface FieldQualityRow {
  campo: string;
  origem: string;
  preenchidos: number;
  total: number;
  taxaPct: number;
  confiabilidade: string;
}

interface CoverageReport {
  geradoEm?: string;
  catalogoFipe?: { total: number; pct: number };
  cobertura?: {
    fipe?: { veiculos: number; pct: number };
    historico?: { veiculos: number; pct: number };
    inmetro?: { veiculos: number; pct: number; registrosFonte?: number };
    fabricantes?: { veiculos: number; pct: number; registrosFonte?: number };
    combinada?: { veiculos: number; pct: number; descricao?: string };
  };
  estimativaEnriquecimentoReal?: Record<string, unknown>;
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

function lookupCoverage(field: DataFieldDef, qualityMap: Map<string, FieldQualityRow>, coverage: CoverageReport | null): {
  taxaPct: number;
  preenchidos: number;
  total: number;
  origem: string;
} {
  const total = coverage?.catalogoFipe?.total ?? qualityMap.get('valor_fipe')?.total ?? 0;
  if (field.reportKey && qualityMap.has(field.reportKey)) {
    const q = qualityMap.get(field.reportKey)!;
    return { taxaPct: q.taxaPct, preenchidos: q.preenchidos, total: q.total, origem: q.origem };
  }
  if (field.id === 'consumo' && qualityMap.has('consumo_estrada')) {
    const q = qualityMap.get('consumo_estrada')!;
    return { taxaPct: q.taxaPct, preenchidos: q.preenchidos, total: q.total, origem: q.origem };
  }
  if (field.id === 'tendencia' || field.id === 'desvalorizacao' || field.id === 'posicao_mercado') {
    const hist = coverage?.cobertura?.historico;
    if (hist) return { taxaPct: hist.pct, preenchidos: hist.veiculos, total, origem: 'DERIVED' };
  }
  return { taxaPct: 0, preenchidos: 0, total, origem: field.fontes[0] ?? 'N/A' };
}

function tierFields(tier: DataTier): DataFieldDef[] {
  if (tier === 'permanente') return PERMANENT_SPEC_FIELDS;
  if (tier === 'semi_dinamico') return PERIODIC_FIELDS;
  return MONTHLY_FIELDS;
}

function buildFontesPrioritarias(coverage: CoverageReport | null) {
  return [
    {
      id: 'inmetro-pbev',
      nome: 'INMETRO PBEV',
      prioridade: 1,
      campos: ['consumo', 'classificacao_energetica'],
      coberturaAtualPct: coverage?.cobertura?.inmetro?.pct ?? 0,
      acao: 'Expandir edicoes PBEV e melhorar matching marca/modelo (ex.: VOLKSWAGEN).',
    },
    {
      id: 'fabricantes',
      nome: 'Fichas tecnicas de fabricantes',
      prioridade: 2,
      campos: ['potencia', 'torque', 'cilindrada', 'cambio', 'peso', 'dimensoes'],
      coberturaAtualPct: coverage?.cobertura?.fabricantes?.pct ?? 0,
      acao: 'Importar JSONs por marca a partir de catalogo em data/sources/manufacturers-catalog.json.',
    },
    {
      id: 'fipe-historico',
      nome: 'FIPE + fipeX historico',
      prioridade: 3,
      campos: ['valor_fipe', 'historico', 'tendencia', 'desvalorizacao'],
      coberturaAtualPct: coverage?.cobertura?.historico?.pct ?? 100,
      acao: 'Manter pipeline mensal catalog:monthly.',
    },
    {
      id: 'recalls-senatran',
      nome: 'Recalls SENATRAN / fabricantes',
      prioridade: 4,
      campos: ['recalls'],
      coberturaAtualPct: 0,
      acao: 'Investigar API ou dump de campanhas de recall.',
    },
    {
      id: 'marketplace',
      nome: 'Marketplace / anuncios',
      prioridade: 5,
      campos: ['liquidez'],
      coberturaAtualPct: 0,
      acao: 'Agregar listings-summary em data/raw/marketplace_data/.',
    },
  ];
}

function buildRoadmapPhases() {
  return [
    {
      fase: 1,
      titulo: 'Fundacao e camadas de storage',
      prazo: 'Sprint 1',
      entregas: [
        'Manifestos data/static, data/periodic, data/monthly',
        'Schema static-vehicle-specs.schema.json',
        'Pipeline datasets:roadmap + relatorio de cobertura',
        'Fix matching INMETRO (marcas) e consumo etanol',
      ],
      camposAlvo: ['consumo', 'classificacao_energetica', 'valor_fipe', 'historico'],
    },
    {
      fase: 2,
      titulo: 'Specs permanentes via fabricantes',
      prazo: 'Sprint 2-3',
      entregas: [
        'Import VW, Fiat, GM, Toyota, Honda specs',
        'Publicar JSON estatico por vehicle_id em data/static/specs/',
        'Secoes specs_motor e specs_dimensoes na pagina',
      ],
      camposAlvo: ['potencia', 'torque', 'cilindrada', 'cambio', 'peso', 'dimensoes'],
    },
    {
      fase: 3,
      titulo: 'Metricas derivadas e UX mercado',
      prazo: 'Sprint 4',
      entregas: [
        'Tendencia, desvalorizacao, posicao_mercado visiveis',
        'Graficos Recharts responsivos',
        'Badges de fonte/confiabilidade',
      ],
      camposAlvo: ['tendencia', 'desvalorizacao', 'posicao_mercado', 'liquidez'],
    },
    {
      fase: 4,
      titulo: 'Camada semi-dinamica (risco)',
      prazo: 'Sprint 5+',
      entregas: [
        'Recalls e indice roubo por modelo',
        'Estimativa seguro e manutencao',
        'Atualizacao trimestral data/periodic/',
      ],
      camposAlvo: ['roubo', 'seguro', 'recalls', 'manutencao'],
    },
  ];
}

async function main() {
  const coverage = readJson<CoverageReport | null>(STORAGE_PATHS.coverageEnrichmentReport, null);
  const fieldQuality = readJson<{ campos?: FieldQualityRow[] }>(STORAGE_PATHS.fieldQualityReport, { campos: [] });
  const enrichmentSummary = readJson<Record<string, unknown> | null>(STORAGE_PATHS.enrichmentSummary, null);

  const qualityMap = new Map<string, FieldQualityRow>();
  for (const row of fieldQuality.campos ?? []) qualityMap.set(row.campo, row);

  const dadosPorCampo = ALL_DATA_FIELDS.map((field) => {
    const cov = lookupCoverage(field, qualityMap, coverage);
    return {
      id: field.id,
      label: field.label,
      tier: field.tier,
      fontes: field.fontes,
      confiabilidade: field.confiabilidade,
      descricao: field.descricao,
      metaCoberturaPct: field.metaCoberturaPct ?? null,
      coberturaAtual: {
        taxaPct: cov.taxaPct,
        preenchidos: cov.preenchidos,
        total: cov.total,
        origemMedida: cov.origem,
        gapPct: field.metaCoberturaPct != null ? Math.max(0, Math.round((field.metaCoberturaPct - cov.taxaPct) * 100) / 100) : null,
      },
    };
  });

  const medidas = dadosPorCampo.filter((d) => d.coberturaAtual.taxaPct > 0);
  const coberturaAtualMedida = {
    camposComDado: medidas.length,
    camposTotal: dadosPorCampo.length,
    mediaTaxaPct: medidas.length
      ? Math.round((medidas.reduce((s, d) => s + d.coberturaAtual.taxaPct, 0) / medidas.length) * 100) / 100
      : 0,
    catalogoFipe: coverage?.catalogoFipe ?? { total: 0, pct: 0 },
    coberturaEnriquecimento: coverage?.cobertura ?? null,
    estimativaEnriquecimentoReal: coverage?.estimativaEnriquecimentoReal ?? null,
    enrichmentSummaryPresente: enrichmentSummary != null,
  };

  const roadmap = {
    geradoEm: new Date().toISOString(),
    missao:
      'Transformar cada pagina de veiculo em uma enciclopedia confiavel: specs permanentes, risco periodico e mercado mensal — sempre com fonte explicita e zero dados inventados.',
    camadasDados: Object.values(DATA_TIERS),
    storagePaths: {
      permanente: STORAGE_PATHS.staticSpecs,
      semiDinamico: STORAGE_PATHS.periodicRoot,
      dinamico: STORAGE_PATHS.monthlyRoot,
      relatorios: STORAGE_PATHS.reportsRoot,
    },
    dadosPorCampo,
    fontesPrioritarias: buildFontesPrioritarias(coverage),
    paginaVeiculo: {
      secoes: VEHICLE_PAGE_SECTIONS,
      principiosUX: [...UX_PRINCIPLES],
    },
    roadmapImplementacao: buildRoadmapPhases(),
    metricasSucesso: [
      { id: 'cobertura_inmetro', meta: 40, atual: coverage?.cobertura?.inmetro?.pct ?? 0, unidade: '% veiculos' },
      { id: 'cobertura_fabricante', meta: 30, atual: coverage?.cobertura?.fabricantes?.pct ?? 0, unidade: '% veiculos' },
      { id: 'cobertura_historico', meta: 100, atual: coverage?.cobertura?.historico?.pct ?? 0, unidade: '% veiculos' },
      { id: 'campos_permanentes_meta', meta: 50, atual: Math.round((PERMANENT_SPEC_FIELDS.filter((f) => (lookupCoverage(f, qualityMap, coverage).taxaPct) >= 10).length / PERMANENT_SPEC_FIELDS.length) * 100), unidade: '% campos com >10%' },
      { id: 'camada_periodic_lancada', meta: 1, atual: 0, unidade: 'boolean (0/1)' },
    ],
    coberturaAtualMedida,
    relatoriosLidos: {
      coverageEnrichmentReport: fs.existsSync(STORAGE_PATHS.coverageEnrichmentReport),
      fieldQualityReport: fs.existsSync(STORAGE_PATHS.fieldQualityReport),
      enrichmentSummary: fs.existsSync(STORAGE_PATHS.enrichmentSummary),
    },
    resumoEnrichment: enrichmentSummary
      ? { geradoEm: enrichmentSummary.geradoEm, objetivo: enrichmentSummary.objetivo }
      : null,
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.vehicleEncyclopediaRoadmap, JSON.stringify(roadmap, null, 2), { encoding: 'utf8' });
  console.log(JSON.stringify({ output: PATHS.vehicleEncyclopediaRoadmap, coberturaAtualMedida: roadmap.coberturaAtualMedida }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
