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
  /** Caminho estatico do JSON do veiculo, ex: /data/fipe/toyota/corolla/2024.json */
  dataPath?: string;
}

export interface StateTaxRate {
  nome: string;
  uf: string;
  aliquota: number;
}
