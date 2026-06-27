import { formatBRL } from '../../../src/lib/format.ts';
import { formatBrandName, formatTitleCase } from '../../../src/lib/display.ts';
import type { PrerenderSeo } from './html-shell.ts';

const SITE_URL = 'https://pesquisatabelafipe.com.br';
const OG_IMAGE = `${SITE_URL}/og-default.svg`;

export interface SeoMarcaModelo {
  slug: string;
  nome: string;
  totalVeiculos: number;
}

export interface SeoMarcaData {
  slug: string;
  nome: string;
  tipo: string;
  totalVeiculos: number;
  totalModelos: number;
  modelos: SeoMarcaModelo[];
}

export interface SeoVersaoData {
  id: string;
  ano: number;
  combustivel: string;
  valor: number;
}

export interface SeoModeloData {
  marcaSlug: string;
  marcaNome: string;
  modeloSlug: string;
  modeloNome: string;
  totalVeiculos: number;
  anos: number[];
  versoes: SeoVersaoData[];
  historico: {
    menorPreco: number | null;
    maiorPreco: number | null;
    valorMedio: number | null;
    pontos: { referencia: string; valorMedio: number }[];
  };
}

export function normalizeMarca(raw: SeoMarcaData): SeoMarcaData {
  return {
    ...raw,
    nome: formatBrandName(raw.nome, raw.slug),
    modelos: (raw.modelos ?? []).map((m) => ({
      ...m,
      nome: formatTitleCase(m.nome),
    })),
  };
}

export function normalizeModelo(raw: SeoModeloData): SeoModeloData {
  return {
    ...raw,
    marcaNome: formatBrandName(raw.marcaNome, raw.marcaSlug),
    modeloNome: formatTitleCase(raw.modeloNome),
    versoes: (raw.versoes ?? []).map((v) => ({
      ...v,
      combustivel: formatTitleCase(v.combustivel),
    })),
  };
}

export function buildMarcaSeo(marca: SeoMarcaData): PrerenderSeo {
  const path = `/marca/${marca.slug}`;
  const canonical = `${SITE_URL}${path}`;
  const title = `Tabela FIPE ${marca.nome} — ${marca.totalModelos} modelos, ${marca.totalVeiculos.toLocaleString('pt-BR')} veículos | PesquisaTabelaFIPE`;
  const description = `Consulte preços FIPE de todos os modelos ${marca.nome}. ${marca.totalVeiculos.toLocaleString('pt-BR')} versões indexadas.`;

  const listItems = marca.modelos.slice(0, 50).map((m, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: m.nome,
    url: `${SITE_URL}/modelo/${marca.slug}/${m.slug}`,
  }));

  return {
    title,
    description,
    canonical,
    og: {
      'og:type': 'website',
      'og:title': title,
      'og:description': description,
      'og:url': canonical,
      'og:site_name': 'PesquisaTabelaFIPE',
      'og:locale': 'pt_BR',
      'og:image': OG_IMAGE,
    },
    twitter: {
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': OG_IMAGE,
    },
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: marca.nome, item: canonical },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Modelos ${marca.nome} — Tabela FIPE`,
        itemListElement: listItems,
      },
    ],
  };
}

export function buildModeloSeo(modelo: SeoModeloData): PrerenderSeo {
  const path = `/modelo/${modelo.marcaSlug}/${modelo.modeloSlug}`;
  const canonical = `${SITE_URL}${path}`;
  const displayName = `${modelo.marcaNome} ${modelo.modeloNome}`;
  const title = `${displayName} — Tabela FIPE por ano | PesquisaTabelaFIPE`;
  const anos = modelo.anos ?? [];
  const anoRange =
    anos.length > 0 ? `Anos ${anos[0]}–${anos[anos.length - 1]}` : '';
  const description = `${modelo.totalVeiculos} versões do ${displayName} na FIPE. ${anoRange}. Preço médio ${formatBRL(modelo.historico.valorMedio ?? 0)}.`;

  return {
    title,
    description,
    canonical,
    og: {
      'og:type': 'article',
      'og:title': title,
      'og:description': description,
      'og:url': canonical,
      'og:site_name': 'PesquisaTabelaFIPE',
      'og:locale': 'pt_BR',
      'og:image': OG_IMAGE,
    },
    twitter: {
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': OG_IMAGE,
    },
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: displayName,
        brand: { '@type': 'Brand', name: modelo.marcaNome },
        description: `Preços FIPE do ${displayName} — ${modelo.totalVeiculos} versões indexadas.`,
        url: canonical,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'BRL',
          lowPrice: modelo.historico.menorPreco ?? undefined,
          highPrice: modelo.historico.maiorPreco ?? undefined,
          offerCount: modelo.totalVeiculos,
          url: canonical,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: modelo.marcaNome,
            item: `${SITE_URL}/marca/${modelo.marcaSlug}`,
          },
          { '@type': 'ListItem', position: 3, name: modelo.modeloNome, item: canonical },
        ],
      },
    ],
  };
}
