import path from 'path';

export const ROOT = process.cwd();

export const PATHS = {
  /** Camada 1 — dumps brutos (fipeX, CSVs, parquet) */
  rawRoot: path.join(ROOT, 'data', 'raw'),
  /** Camada 2 — veículos normalizados antes de publicar */
  normalizedRoot: path.join(ROOT, 'data', 'normalized'),
  /** Índices auxiliares (marcas, modelos, métricas) */
  indexesRoot: path.join(ROOT, 'data', 'indexes'),
  /** Registro de fontes investigadas */
  sourcesCatalog: path.join(ROOT, 'data', 'sources', 'catalog.json'),
  /** Relatórios de cobertura automáticos */
  coverageReport: path.join(ROOT, 'data', 'indexes', 'coverage-report.json'),
  reportsRoot: path.join(ROOT, 'data', 'reports'),
  historyRoot: path.join(ROOT, 'data', 'history'),
  dataQualityReport: path.join(ROOT, 'data', 'reports', 'data-quality-report.json'),
  historyReport: path.join(ROOT, 'data', 'reports', 'history-report.json'),
  coverageValidation: path.join(ROOT, 'data', 'reports', 'coverage-validation.json'),
  seoOpportunities: path.join(ROOT, 'data', 'reports', 'seo-opportunities.json'),
  performanceReport: path.join(ROOT, 'data', 'reports', 'performance-report.json'),
  executiveReport: path.join(ROOT, 'data', 'reports', 'executive-report.json'),
  enrichmentSchema: path.join(ROOT, 'data', 'schemas', 'vehicle-enrichment.schema.json'),
  checkpoint: path.join(ROOT, 'data', 'fipe', 'checkpoint.json'),
  relatorio: path.join(ROOT, 'data', 'fipe', 'relatorio.json'),
  srcMarcas: path.join(ROOT, 'src', 'data', 'fipe', 'marcas.json'),
  srcModelos: path.join(ROOT, 'src', 'data', 'fipe', 'modelos.json'),
  srcVeiculos: path.join(ROOT, 'src', 'data', 'fipe', 'veiculos.json'),
  srcSearchIndex: path.join(ROOT, 'src', 'data', 'fipe', 'search-index.json'),
  publicDataRoot: path.join(ROOT, 'public', 'data', 'fipe'),
  publicMarcas: path.join(ROOT, 'public', 'data', 'fipe', 'marcas.json'),
  publicModelos: path.join(ROOT, 'public', 'data', 'fipe', 'modelos.json'),
  publicSearchDir: path.join(ROOT, 'public', 'data', 'fipe', 'search'),
  publicSearchManifest: path.join(ROOT, 'public', 'data', 'fipe', 'search', 'manifest.json'),
  publicHistoricoRoot: path.join(ROOT, 'public', 'data', 'historico'),
  legacyVeiculos: path.join(ROOT, 'public', 'api', 'fipe', 'veiculos'),
  legacyHistorico: path.join(ROOT, 'public', 'api', 'historico'),
  legacySearchDir: path.join(ROOT, 'public', 'api', 'fipe', 'search'),
} as const;

export function historicoSnapshotDir(month: string): string {
  return path.join(PATHS.publicHistoricoRoot, month);
}
