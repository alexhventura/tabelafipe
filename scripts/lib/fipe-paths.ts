import path from 'path';

export const ROOT = process.cwd();

export const PATHS = {
  /** Camada 1 â€” dumps brutos (fipeX, CSVs, parquet) */
  rawRoot: path.join(ROOT, 'data', 'raw'),
  /** Camada 2 â€” veÃ­culos normalizados antes de publicar */
  normalizedRoot: path.join(ROOT, 'data', 'normalized'),
  /** Camada 3 â€” merge de fontes por vehicle_id */
  enrichedRoot: path.join(ROOT, 'data', 'enriched'),
  /** Camada 4 â€” JSON final consumido pelas pÃ¡ginas */
  generatedRoot: path.join(ROOT, 'data', 'generated'),
  /** RAW â€” INMETRO PBEV */
  rawInmetro: path.join(ROOT, 'data', 'raw', 'inmetro'),
  /** RAW â€” fichas de fabricantes */
  rawManufacturers: path.join(ROOT, 'data', 'raw', 'manufacturers'),
  /** RAW â€” catalogos historicos OEM (PDF/HTML por ano) */
  rawCatalogs: path.join(ROOT, 'data', 'raw', 'catalogs'),
  rawCatalogsParsed: path.join(ROOT, 'data', 'raw', 'catalogs', 'parsed-records.json'),
  catalogsManifest: path.join(ROOT, 'data', 'raw', 'catalogs', 'manifest.json'),
  /** RAW â€” manuais do proprietario */
  rawManuals: path.join(ROOT, 'data', 'raw', 'manuals'),
  /** RAW â€” marketplace (futuro) */
  rawMarketplace: path.join(ROOT, 'data', 'raw', 'marketplace_data'),
  /** Manifesto de fontes raw */
  rawManifest: path.join(ROOT, 'data', 'raw', 'manifest.json'),
  /** Ãndice de match global */
  normalizedMatchIndex: path.join(ROOT, 'data', 'normalized', 'match-index.json'),
  /** CatÃ¡logo normalizado canÃ´nico */
  normalizedVeiculos: path.join(ROOT, 'data', 'normalized', 'veiculos.json'),
  /** Manifesto da camada enriched */
  enrichedManifest: path.join(ROOT, 'data', 'enriched', 'manifest.json'),
  /** Manifesto da camada generated */
  generatedManifest: path.join(ROOT, 'data', 'generated', 'manifest.json'),
  /** RelatÃ³rio do pipeline de enriquecimento */
  enrichmentPipelineReport: path.join(ROOT, 'data', 'reports', 'enrichment-pipeline-report.json'),
  /** INMETRO normalizado */
  normalizedInmetro: path.join(ROOT, 'data', 'normalized', 'inmetro'),
  normalizedInmetroRecords: path.join(ROOT, 'data', 'normalized', 'inmetro', 'pbev-records.json'),
  normalizedInmetroManifest: path.join(ROOT, 'data', 'normalized', 'inmetro', 'manifest.json'),
  inmetroPbevCatalog: path.join(ROOT, 'data', 'sources', 'inmetro-pbev-catalog.json'),
  manufacturersCatalog: path.join(ROOT, 'data', 'sources', 'manufacturers-catalog.json'),
  coverageEnrichmentReport: path.join(ROOT, 'data', 'reports', 'coverage-enrichment.json'),
  inmetroCoverageReport: path.join(ROOT, 'data', 'reports', 'inmetro-coverage-report.json'),
  manufacturersCoverageReport: path.join(ROOT, 'data', 'reports', 'manufacturers-coverage-report.json'),
  fieldQualityReport: path.join(ROOT, 'data', 'reports', 'field-quality-report.json'),
  vehicleEncyclopediaRoadmap: path.join(ROOT, 'data', 'reports', 'vehicle-encyclopedia-roadmap.json'),
  vehicleListComplete: path.join(ROOT, 'data', 'indexes', 'vehicle-list-complete.json'),
  vehicleListCompleteSummary: path.join(ROOT, 'data', 'reports', 'vehicle-list-complete-summary.json'),
  dataCoverageReport: path.join(ROOT, 'data', 'reports', 'data-coverage-report.json'),
  dataCoverageReportMd: path.join(ROOT, 'data', 'reports', 'data-coverage-report.md'),
  matchingReport: path.join(ROOT, 'data', 'reports', 'matching-report.json'),
  dashboardSummary: path.join(ROOT, 'data', 'reports', 'dashboard-summary.json'),
  vehicleSearchIndex: path.join(ROOT, 'data', 'indexes', 'vehicle-search-index.json'),
  rawSafety: path.join(ROOT, 'data', 'raw', 'safety'),
  rawRecalls: path.join(ROOT, 'data', 'raw', 'recalls'),
  normalizedSafety: path.join(ROOT, 'data', 'normalized', 'safety', 'latin-ncap.json'),
  normalizedRecalls: path.join(ROOT, 'data', 'normalized', 'recalls', 'recalls.json'),
  normalizedWarranty: path.join(ROOT, 'data', 'normalized', 'warranty', 'warranty.json'),
  safetyCatalog: path.join(ROOT, 'data', 'sources', 'safety-catalog.json'),
  recallsCatalog: path.join(ROOT, 'data', 'sources', 'recalls-catalog.json'),
  generationsCatalog: path.join(ROOT, 'data', 'sources', 'generations-catalog.json'),
  matchingAnalysisReport: path.join(ROOT, 'data', 'reports', 'matching-analysis.json'),
  specCoverageReport: path.join(ROOT, 'data', 'reports', 'spec-coverage-report.json'),
  encyclopediaCoverageReport: path.join(ROOT, 'data', 'reports', 'encyclopedia-coverage-report.json'),
  specsMaster: path.join(ROOT, 'data', 'generated', 'specs-master.json'),
  manualSpecs: path.join(ROOT, 'data', 'generated', 'manual-specs.json'),
  vehicleRelations: path.join(ROOT, 'data', 'generated', 'vehicle-relations.json'),
  coverageRankingReport: path.join(ROOT, 'data', 'reports', 'coverage-ranking-report.json'),
  /** Camada PERMANENTE â€” specs capturadas uma vez, versionadas */
  staticRoot: path.join(ROOT, 'data', 'static'),
  staticSpecs: path.join(ROOT, 'data', 'static', 'specs'),
  staticSpecsManifest: path.join(ROOT, 'data', 'static', 'specs', 'manifest.json'),
  staticSpecsCatalog: path.join(ROOT, 'data', 'static', 'specs', 'catalog.json'),
  staticSpecsSchema: path.join(ROOT, 'data', 'schemas', 'static-vehicle-specs.schema.json'),
  /** Camada SEMI-DINÃ‚MICA â€” atualizaÃ§Ã£o trimestral/semestral */
  periodicRoot: path.join(ROOT, 'data', 'periodic'),
  periodicManifest: path.join(ROOT, 'data', 'periodic', 'manifest.json'),
  /** Camada DINÃ‚MICA â€” atualizaÃ§Ã£o mensal (FIPE, histÃ³rico, rankings) */
  monthlyRoot: path.join(ROOT, 'data', 'monthly'),
  monthlyManifest: path.join(ROOT, 'data', 'monthly', 'manifest.json'),
  /** Ãndices auxiliares (marcas, modelos, mÃ©tricas) */
  indexesRoot: path.join(ROOT, 'data', 'indexes'),
  /** Registro de fontes investigadas */
  sourcesCatalog: path.join(ROOT, 'data', 'sources', 'catalog.json'),
  /** RelatÃ³rios de cobertura automÃ¡ticos */
  coverageReport: path.join(ROOT, 'data', 'indexes', 'coverage-report.json'),
  reportsRoot: path.join(ROOT, 'data', 'reports'),
  seedImpactReport: path.join(ROOT, 'data', 'reports', 'seed-impact-report.json'),
  /** Indice central de PDFs OEM */
  catalogIndexRoot: path.join(ROOT, 'data', 'catalog-index'),
  catalogIndex: path.join(ROOT, 'data', 'catalog-index', 'index.json'),
  catalogIndexHashes: path.join(ROOT, 'data', 'catalog-index', 'hashes.json'),
  catalogIndexPdfs: path.join(ROOT, 'data', 'catalog-index', 'pdfs'),
  familiesTarget: path.join(ROOT, 'data', 'catalog-index', 'families-target.json'),
  documentLibraryRoot: path.join(ROOT, 'data', 'document-library'),
  documentLibraryIndex: path.join(ROOT, 'data', 'document-library', 'index.json'),
  documentLibraryFiles: path.join(ROOT, 'data', 'document-library', 'files'),
  documentLibraryHashes: path.join(ROOT, 'data', 'document-library', 'hashes.json'),
  documentLibraryMetrics: path.join(ROOT, 'data', 'reports', 'document-library-metrics.json'),
  enginesCatalog: path.join(ROOT, 'data', 'sources', 'engines-catalog.json'),
  engineGraph: path.join(ROOT, 'data', 'generated', 'engine-graph.json'),
  transmissionsCatalog: path.join(ROOT, 'data', 'sources', 'transmissions-catalog.json'),
  transmissionGraph: path.join(ROOT, 'data', 'generated', 'transmission-graph.json'),
  maintenanceGraph: path.join(ROOT, 'data', 'generated', 'maintenance-graph.json'),
  platformsCatalog: path.join(ROOT, 'data', 'sources', 'platforms-catalog.json'),
  platformGraph: path.join(ROOT, 'data', 'generated', 'platform-graph.json'),
  familyCoverageReport: path.join(ROOT, 'data', 'reports', 'coverage-by-family-report.json'),
  maintenanceSpecs: path.join(ROOT, 'data', 'generated', 'maintenance-specs.json'),
  engineMaster: path.join(ROOT, 'data', 'generated', 'engine-master.json'),
  maintenanceMaster: path.join(ROOT, 'data', 'generated', 'maintenance-master.json'),
  acquisitionDashboard: path.join(ROOT, 'data', 'reports', 'acquisition-dashboard.json'),
  documentAcquisitionLog: path.join(ROOT, 'data', 'document-library', 'acquisition-log.json'),
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
  vehicleBundlesRoot: path.join(ROOT, 'public', 'data', 'bundles'),
  vehicleBundleManifest: path.join(ROOT, 'public', 'data', 'bundles', 'manifest.json'),
  vehicleUrlMap: path.join(ROOT, 'data', 'generated', 'vehicle-url-map.json'),
  vehicleBundleAudit: path.join(ROOT, 'data', 'reports', 'vehicle-bundle-architecture-audit.json'),
  portalAuditReport: path.join(ROOT, 'data', 'reports', 'portal-audit-report.json'),
  publicVehicleUrlMap: path.join(ROOT, 'public', 'data', 'vehicle-url-map.json'),
  hubBundlesRoot: path.join(ROOT, 'public', 'data', 'hubs'),
  hubManifest: path.join(ROOT, 'public', 'data', 'hubs', 'manifest.json'),
} as const;

export function historicoSnapshotDir(month: string): string {
  return path.join(PATHS.publicHistoricoRoot, month);
}
