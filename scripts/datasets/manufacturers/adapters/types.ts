import type { ManufacturerRecord } from "../../../lib/enrichment/manufacturer-record.js";

export interface HtmlPageSeed {
  url: string;
  modelo: string;
  ano?: number;
  versao?: string;
}

export interface PdfCatalogSeed {
  url: string;
  modelo: string;
  ano?: number;
  versao?: string;
  tipo?: string;
}

export interface BrandAdapterConfig {
  slug: string;
  nome: string;
  strategy: "html" | "pdf" | "mixed";
  discoveryBaseUrl?: string;
  autoDiscover?: boolean;
  htmlPages?: HtmlPageSeed[];
  pdfCatalogs?: PdfCatalogSeed[];
}

export interface BrandAdapter extends BrandAdapterConfig {
  crawl(options?: CrawlOptions): Promise<ManufacturerRecord[]>;
}

export type CrawlOptions = {
  discover?: boolean;
};

export type CrawlResult = {
  slug: string;
  registros: number;
  strategy: string;
  discoveredPages?: number;
  erros?: string[];
};
