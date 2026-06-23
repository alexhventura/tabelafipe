export type VehicleTipo = 'carros' | 'motos' | 'caminhoes';

export interface ConsumoData {
  cidadeG: number;
  cidadeE: number;
  estradaG: number;
  estradaE: number;
}

export interface HistoricoPreco {
  mes: string;
  valor: number;
}

export interface Vehicle {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  anoModelo: number;
  fipeCodigo: string;
  combustivel: string;
  valorAtual: number;
  categoriaPecas: 'baixa' | 'media' | 'alta';
  consumo: ConsumoData;
  historicoPrecos: HistoricoPreco[];
}

export interface SearchIndexItem {
  id: string;
  termoBusca: string;
  nome: string;
  valor: number;
  marca?: string;
  ano?: number;
  combustivel?: string;
  tipo?: VehicleTipo;
  popularidade?: number;
  /** Codigo FIPE ex: 001234-5 */
  fipeCodigo?: string;
  /** URL canonica pre-calculada no build */
  canonicalPath?: string;
  pageSlug?: string;
  /** Texto normalizado para ranking (nome + modelo, sem aliases expandidos) */
  searchText?: string;
  /** Modelo normalizado para autocomplete alfabético */
  modelo?: string;
  /** Caminho estatico do JSON do veiculo, ex: /data/fipe/toyota/corolla/2024.json */
  dataPath?: string;
}

export interface FamilySearchItem {
  id: string;
  familia: string;
  familiaDisplay: string;
  marca: string;
  marcaSlug: string;
  tipo: VehicleTipo;
  versaoCount: number;
  valorMin: number;
  valorMax: number;
  anoMin: number;
  anoMax: number;
  hubPath?: string;
}

export interface BrandSearchItem {
  slug: string;
  nome: string;
  tipo: VehicleTipo;
  familyCount: number;
  vehicleCount: number;
  hubPath: string;
}

export type SearchSuggestion =
  | {
      kind: 'marca';
      item: BrandSearchItem;
      confidence: number;
    }
  | {
      kind: 'familia';
      item: FamilySearchItem;
      confidence: number;
    }
  | {
      kind: 'veiculo';
      item: SearchIndexItem;
      /** 0–1: confiança do match para abrir direto com Enter */
      confidence: number;
      /** Modo browse: sugestão representa a família (clique ainda abre o veículo) */
      browseFamily?: string;
    };

export interface StateTaxRate {
  nome: string;
  uf: string;
  aliquota: number;
}
