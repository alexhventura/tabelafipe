export interface RelatedLink {
  vehicleId: string;
  fipeCodigo: string;
  displayName: string;
  valorAtual: number;
  canonicalPath: string;
  ano: number;
  marca: string;
  displayYear?: DisplayYear;
}

export type DisplayYearKind = 'year' | 'zero_km' | 'hidden';

export interface DisplayYear {
  kind: DisplayYearKind;
  year?: number;
  label: string;
  shortLabel: string;
}

export interface VehicleRelatedLinks {
  mesmaGeracao: RelatedLink[];
  mesmaPlataforma: RelatedLink[];
  mesmoMotor: RelatedLink[];
  mesmaTransmissao: RelatedLink[];
  mesmaFamilia: RelatedLink[];
  mesmaFaixaPreco: RelatedLink[];
  concorrentes: RelatedLink[];
}

export interface FaqItem {
  pergunta: string;
  resposta: string;
}

export interface VehiclePageSectionFlags {
  preco: boolean;
  historico: boolean;
  specs: boolean;
  engine: boolean;
  maintenance: boolean;
  platform: boolean;
  transmission: boolean;
  generation: boolean;
  inmetro: boolean;
  relacionados: boolean;
}

export interface VehiclePageSeo {
  title: string;
  description: string;
  h1: string;
  canonical: string;
  canonicalPath: string;
  og: Record<string, string>;
  twitter: Record<string, string>;
  jsonLd: Record<string, unknown>[];
  breadcrumb: { name: string; path: string }[];
}

export interface HistoricoPonto {
  referencia?: string;
  mes?: string;
  valor: number;
  data?: string;
}

export interface VehiclePageBundle {
  geradoEm: string;
  bundlePath: string;
  identity: {
    vehicleId: string;
    marca: string;
    marcaSlug: string;
    modelo: string;
    ano: number;
    anoModelo: number;
    displayYear?: DisplayYear;
    combustivel: string;
    tipo: string;
    displayName: string;
    pageSlug: string;
  };
  fipe: {
    fipeCodigo: string;
    valorAtual: number;
    mesReferencia: string;
    historico: HistoricoPonto[];
    trend6m: number | null;
  };
  specs: Record<string, unknown> | null;
  engine: {
    engineId: string | null;
    engineNome: string | null;
    entity: Record<string, unknown> | null;
  } | null;
  maintenance: Record<string, unknown> | null;
  platform: {
    platformId: string | null;
    platformNome: string | null;
    entity: Record<string, unknown> | null;
  } | null;
  transmission: {
    transmissionId: string | null;
    transmissionNome: string | null;
  } | null;
  generation: {
    geracaoId: string | null;
    familia: string | null;
    catalogEntry: Record<string, unknown> | null;
  } | null;
  inmetro: Record<string, unknown> | null;
  safety: Record<string, unknown> | null;
  recalls: Record<string, unknown> | null;
  warranty: Record<string, unknown> | null;
  sections: VehiclePageSectionFlags;
  related: VehicleRelatedLinks;
  faq: FaqItem[];
  seo: VehiclePageSeo;
}
