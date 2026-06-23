import { SITE_URL, buildCanonicalPath, buildCanonicalUrl } from './canonical-url.js';
import type { FaqItem, VehiclePageSeo } from './vehicle-bundle-types.js';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1).replace('.', ',')}%`;
}

export interface SeoBundleInput {
  marca: string;
  marcaSlug: string;
  displayName: string;
  ano: number;
  fipeCodigo: string;
  valorAtual: number;
  pageSlug: string;
  specsLine?: string;
  faq: FaqItem[];
}

function productJsonLd(input: SeoBundleInput, canonical: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${input.displayName} ${input.ano}`,
    brand: { '@type': 'Brand', name: input.marca },
    sku: input.fipeCodigo,
    url: canonical,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: input.valorAtual,
      availability: 'https://schema.org/InStock',
      url: canonical,
    },
  };
}

function breadcrumbJsonLd(input: SeoBundleInput, canonicalPath: string): Record<string, unknown> {
  const items = [
    { '@type': 'ListItem', position: 1, name: 'FIPE', item: `${SITE_URL}/fipe/` },
    { '@type': 'ListItem', position: 2, name: input.marca, item: `${SITE_URL}/fipe/${input.marcaSlug}/` },
    { '@type': 'ListItem', position: 3, name: `${input.displayName} ${input.ano}`, item: `${SITE_URL}${canonicalPath}` },
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

function faqJsonLd(faq: FaqItem[]): Record<string, unknown> | null {
  if (!faq.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta },
    })),
  };
}

export function buildVehicleSeo(input: SeoBundleInput): VehiclePageSeo {
  const canonicalPath = buildCanonicalPath(input.marca, input.pageSlug);
  const canonical = buildCanonicalUrl(input.marca, input.pageSlug);
  const valor = formatBRL(input.valorAtual);
  const title = `${input.displayName} ${input.ano} — Tabela FIPE | ${valor}`;
  const specsBit = input.specsLine ? ` ${input.specsLine}.` : '';
  const description = `Consulte o preço FIPE do ${input.displayName} ${input.ano} (código ${input.fipeCodigo}): ${valor}.${specsBit} Histórico, ficha técnica e veículos relacionados.`;
  const h1 = `${input.displayName} ${input.ano}`;
  const og = {
    'og:type': 'article',
    'og:title': title,
    'og:description': description,
    'og:url': canonical,
    'og:site_name': 'Pesquisa Tabela FIPE',
    'og:locale': 'pt_BR',
  };
  const twitter = {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
  };
  const jsonLd: Record<string, unknown>[] = [productJsonLd(input, canonical), breadcrumbJsonLd(input, canonicalPath)];
  const faqLd = faqJsonLd(input.faq);
  if (faqLd) jsonLd.push(faqLd);
  const breadcrumb = [
    { name: 'FIPE', path: '/fipe/' },
    { name: input.marca, path: `/fipe/${input.marcaSlug}/` },
    { name: `${input.displayName} ${input.ano}`, path: canonicalPath },
  ];
  return { title, description, h1, canonical, canonicalPath, og, twitter, jsonLd, breadcrumb };
}
