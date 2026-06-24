/** Tipos do motor de enriquecimento automotivo (batch, offline). */

export type VehicleTipo = 'carros' | 'motos' | 'caminhoes';
export type CategoriaPecas = 'baixa' | 'media' | 'alta';
export type Segmento =
  | 'hatch'
  | 'sedan'
  | 'suv'
  | 'pickup'
  | 'wagon'
  | 'coupe'
  | 'moto'
  | 'caminhao'
  | 'utilitario'
  | 'outro';

export type UsageProfile = 'urbano' | 'estrada' | 'misto';
export type SourceId = 'FIPE' | 'INMETRO' | 'MANUFACTURER' | 'MARKETPLACE' | 'DERIVED';

export interface SourceAttribution {
  source: SourceId;
  field: string;
  confidence: 'high' | 'medium' | 'low';
  matchedBy?: string;
}

export interface FipeVehicle {
  id: string;
  slug: string;
  tipo: VehicleTipo;
  marca: string;
  marcaSlug: string;
  modelo: string;
  ano: number;
  combustivel: string;
  fipeCodigo: string;
  valor: number;
  mesReferencia: string;
  dataPath?: string;
}

export interface NormalizedVehicle extends FipeVehicle {
  vehicleId: string;
  /** Identificador universal cross-fonte (marca+versao+ano+combustivel) */
  vehicleUid: string;
  matchKeys: string[];
  combustivelSlug: string;
  modeloSlug: string;
  versaoNormalizada: string;
}

export interface HistoricoPonto {
  referencia: string;
  data?: string;
  valor: number;
}

export interface HistoricoMetricas {
  menorPreco: number | null;
  maiorPreco: number | null;
  desvalorizacaoPercentual: number | null;
  mediaAnual: number | null;
  totalReferencias: number;
}

export interface InmetroData {
  consumoCidade: number | null;
  consumoEstrada: number | null;
  consumoCidadeEtanol: number | null;
  consumoEstradaEtanol: number | null;
  potenciaCv: number | null;
  cilindradaCc: number | null;
  classificacaoEnergetica: string | null;
  fonte: 'inmetro-pbev';
  matchKey?: string;
  edicaoId?: string;
  anoReferencia?: number;
  matchTier?: 'exact' | 'trim' | 'family_prefix';
  confidence?: number;
  matchedBy?: string;
}

export interface SpecsData {
  potenciaCv: number | null;
  torqueNm: number | null;
  cilindradaCc: number | null;
  cambio: string | null;
  pesoKg: number | null;
  comprimentoMm: number | null;
  larguraMm: number | null;
  alturaMm: number | null;
  portaMalasL: number | null;
  tanqueL: number | null;
  aceleracao0a100: number | null;
  velocidadeMaxKmh: number | null;
  fonte: string | null;
}

export interface SafetyData {
  notaGeral: number | null;
  protecaoAdultos: number | null;
  protecaoInfantis: number | null;
  dataTeste: string | null;
  fonte: 'latin-ncap';
}

export interface RecallData {
  ativos: number;
  encerrados: number;
  total: number;
  campanhas: { id: string; titulo: string; status: string; data?: string }[];
  fonte: string;
}

export interface WarrantyData {
  garantiaTotalAnos: number | null;
  garantiaAnticorrosaoAnos: number | null;
  garantiaMotorAnos: number | null;
  fonte: string | null;
}

export interface MarketData {
  precoMedioAnuncio: number | null;
  totalAnuncios: number | null;
  fonte: string | null;
}

export type PriceBand = 'economico' | 'intermediario' | 'premium' | 'luxo';
export type SizeCategory = 'compacto' | 'medio' | 'grande' | 'utilitario';

export interface DerivedMetrics {
  price_trend_12m: number | null;
  price_trend_24m: number | null;
  depreciation_rate: number | null;
  market_position_rank: number | null;
  market_position_percentile: number | null;
  segment: Segmento;
  size_category: SizeCategory;
  price_band: PriceBand;
  main_fuel: string;
  efficiency_level: string | null;
  affordability_score: number | null;
  maintenance_estimate: {
    categoria: CategoriaPecas;
    perfil: 'economico' | 'medio' | 'premium';
    fonte: 'derived';
    metodo: string;
  };
  usage_profile: UsageProfile;
  competitors: string[];
  similar_vehicles: string[];
  previous_version_id: string | null;
  next_version_id: string | null;
  technical_summary: string;
  fonte: 'derived';
}

export interface EnrichedVehicle {
  vehicleId: string;
  vehicleUid: string;
  vehicle: FipeVehicle;
  historico: HistoricoPonto[];
  historicoMetricas: HistoricoMetricas | null;
  inmetro: InmetroData | null;
  specs: SpecsData | null;
  safety: SafetyData | null;
  recalls: RecallData | null;
  warranty: WarrantyData | null;
  market: MarketData | null;
  derived: DerivedMetrics;
  categoriaPecas: CategoriaPecas;
  attributions: SourceAttribution[];
  metadata: {
    sources: SourceId[];
    last_updated: string;
    pipeline_version: number;
  };
}

export interface GeneratedVehicle {
  vehicle: FipeVehicle & {
    nome: string;
    anoModelo: number;
    valorAtual: number;
    historicoPrecos: { mes: string; valor: number }[];
    categoriaPecas: CategoriaPecas;
    consumo: {
      cidadeG: number | null;
      cidadeE: number | null;
      estradaG: number | null;
      estradaE: number | null;
    };
  };
  inmetro: InmetroData | null;
  specs: SpecsData | null;
  safety: SafetyData | null;
  recalls: RecallData | null;
  warranty: WarrantyData | null;
  market: MarketData | null;
  derived: DerivedMetrics;
  metadata: EnrichedVehicle['metadata'];
}

export interface RawSourceManifest {
  geradoEm: string;
  fontes: {
    id: string;
    path: string;
    presente: boolean;
    registros?: number;
    observacao?: string;
  }[];
}

export interface PipelineReport {
  geradoEm: string;
  camadas: {
    raw: { fontesPresentes: number; fontesTotal: number };
    normalized: { veiculos: number; matchKeys: number };
    enriched: { veiculos: number; comInmetro: number; comHistorico: number; comSpecs: number };
    generated: { veiculos: number };
  };
  cobertura: {
    inmetroPct: number;
    historicoPct: number;
    specsPct: number;
    derivedPct: number;
  };
}
