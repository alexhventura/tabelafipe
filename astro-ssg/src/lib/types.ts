export type UrlEntry = {
  canonicalPath: string;
  pageSlug: string;
  bundlePath: string;
  fipeCodigo: string;
};

export type RelatedLink = {
  vehicleId: string;
  fipeCodigo: string;
  displayName: string;
  valorAtual: number;
  canonicalPath: string;
  ano: number;
  marca: string;
};

export type HubBundle = {
  tipo: 'familia' | 'geracao' | 'motor' | 'plataforma';
  slug: string;
  canonicalPath: string;
  titulo: string;
  descricao: string;
  seo: {
    title: string;
    description: string;
    h1: string;
    canonical: string;
    og?: Record<string, string>;
    twitter?: Record<string, string>;
    jsonLd?: Record<string, unknown>[];
    breadcrumb?: { name: string; path: string }[];
  };
  veiculos: RelatedLink[];
  stats?: { total: number; precoMin?: number; precoMax?: number; anos?: number[] };
  meta?: Record<string, unknown>;
};

export type VehicleBundle = {
  identity: {
    marca: string;
    marcaSlug: string;
    modelo: string;
    ano: number;
    combustivel: string;
    displayName: string;
    pageSlug: string;
  };
  fipe: {
    fipeCodigo: string;
    valorAtual: number;
    mesReferencia: string;
    historico: { referencia?: string; valor: number }[];
    trend6m: number | null;
  };
  specs: Record<string, unknown> | null;
  engine: { engineNome: string | null; entity: Record<string, unknown> | null } | null;
  platform: { platformNome: string | null } | null;
  transmission: { transmissionNome: string | null } | null;
  generation: { geracaoId: string | null; familia: string | null; catalogEntry: Record<string, unknown> | null } | null;
  inmetro: Record<string, unknown> | null;
  safety: Record<string, unknown> | null;
  warranty: Record<string, unknown> | null;
  recalls: Record<string, unknown> | null;
  maintenance: Record<string, unknown> | null;
  sections: Record<string, boolean>;
  related: Record<string, RelatedLink[]>;
  faq: { pergunta: string; resposta: string }[];
  seo: {
    title: string;
    description: string;
    h1: string;
    canonical: string;
    canonicalPath: string;
    og: Record<string, string>;
    twitter: Record<string, string>;
    jsonLd: Record<string, unknown>[];
    breadcrumb: { name: string; path: string }[];
  };
};
