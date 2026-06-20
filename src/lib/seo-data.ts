import { modeloDataFile } from './seo-routes';

export interface SeoMarcaModelo {
  slug: string;
  nome: string;
  totalVeiculos: number;
}

export interface SeoMarca {
  slug: string;
  nome: string;
  tipo: string;
  totalVeiculos: number;
  totalModelos: number;
  modelos: SeoMarcaModelo[];
}

export interface SeoVersao {
  id: string;
  ano: number;
  combustivel: string;
  valor: number;
  fipeCodigo?: string;
}

export interface SeoHistoricoAgregado {
  menorPreco: number | null;
  maiorPreco: number | null;
  valorMedio: number | null;
  valorizacaoPercentual: number | null;
  desvalorizacaoPercentual: number | null;
  pontos: { referencia: string; valorMedio: number }[];
}

export interface SeoModelo {
  marcaSlug: string;
  marcaNome: string;
  modeloSlug: string;
  modeloNome: string;
  totalVeiculos: number;
  anos: number[];
  versoes: SeoVersao[];
  historico: SeoHistoricoAgregado;
}

export interface SeoAnoEntry {
  ano: number;
  totalVeiculos: number;
  marcas: number;
  modelos: number;
  topVeiculos: { id: string; marcaSlug: string; nome: string; valor: number }[];
}

export interface SeoComparativoPar {
  slug: string;
  segmento: string;
  score?: number;
  a: {
    marcaSlug: string;
    modeloSlug: string;
    marcaNome: string;
    modeloNome: string;
    totalVeiculos: number;
    valorMedio: number;
  };
  b: {
    marcaSlug: string;
    modeloSlug: string;
    marcaNome: string;
    modeloNome: string;
    totalVeiculos: number;
    valorMedio: number;
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadMarcas(): Promise<SeoMarca[]> {
  const data = await fetchJson<SeoMarca[] | { marcas: SeoMarca[] }>('/data/seo/marcas.json');
  if (!data) return [];
  return Array.isArray(data) ? data : (data.marcas ?? []);
}

export async function loadMarca(slug: string): Promise<SeoMarca | null> {
  const marcas = await loadMarcas();
  return marcas.find((m) => m.slug === slug) ?? null;
}

export async function loadModelo(marcaSlug: string, modeloSlug: string): Promise<SeoModelo | null> {
  return fetchJson<SeoModelo>(modeloDataFile(marcaSlug, modeloSlug));
}

export async function loadAnos(): Promise<SeoAnoEntry[]> {
  const data = await fetchJson<{ anos: SeoAnoEntry[] }>('/data/seo/anos.json');
  return data?.anos ?? [];
}

export async function loadAno(ano: number): Promise<SeoAnoEntry | null> {
  const anos = await loadAnos();
  return anos.find((a) => a.ano === ano) ?? null;
}

export async function loadComparativos(): Promise<SeoComparativoPar[]> {
  const data = await fetchJson<{ pares: SeoComparativoPar[] }>('/data/seo/comparativos.json');
  return data?.pares ?? [];
}

export async function loadComparativo(slug: string): Promise<SeoComparativoPar | null> {
  const pares = await loadComparativos();
  return pares.find((p) => p.slug === slug) ?? null;
}
