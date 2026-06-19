import { useEffect, useState } from 'react';
import { SearchIndexItem, VehicleTipo } from '../types';
import { marcaSlug } from '../lib/slug';
import { normalizeText } from '../lib/search';

interface CompactShardItem {
  i: string;
  n: string;
  m: string;
  a: number;
  v: number;
  t: VehicleTipo;
  c?: string;
  s: string;
}

function expandCompact(item: CompactShardItem): SearchIndexItem {
  return {
    id: item.i,
    nome: item.n,
    valor: item.v,
    ano: item.a,
    marca: item.m,
    combustivel: item.c,
    tipo: item.t,
    termoBusca: item.s,
    searchText: normalizeText(item.n),
  };
}

function enrichIndexItem(raw: SearchIndexItem): SearchIndexItem {
  const anoMatch = raw.nome.match(/\((\d{4})\)/);
  const ano = raw.ano ?? (anoMatch ? parseInt(anoMatch[1], 10) : undefined);

  let marca = raw.marca;
  if (!marca || marca.length < 3) {
    const termo = raw.termoBusca.toLowerCase();
    if (termo.includes('toyota')) marca = 'Toyota';
    else if (termo.includes('chevrolet') || termo.includes('gm ')) marca = 'Chevrolet';
    else if (termo.includes('volkswagen') || termo.includes('vw ')) marca = 'Volkswagen';
    else if (termo.includes('fiat')) marca = 'Fiat';
    else if (termo.includes('honda')) marca = 'Honda';
    else if (termo.includes('hyundai')) marca = 'Hyundai';
    else if (termo.includes('ford')) marca = 'Ford';
    else if (termo.includes('renault')) marca = 'Renault';
    else if (termo.includes('jeep')) marca = 'Jeep';
    else if (termo.includes('nissan')) marca = 'Nissan';
    else marca = raw.nome.split(' ')[0];
  }

  let combustivel = raw.combustivel;
  if (!combustivel) {
    const t = raw.termoBusca.toLowerCase();
    if (t.includes('diesel')) combustivel = 'Diesel';
    else if (t.includes('hibrid') || t.includes('hybrid')) combustivel = 'Híbrido';
    else if (t.includes('gasolina')) combustivel = 'Gasolina';
    else combustivel = 'Flex';
  }

  const tipo: VehicleTipo =
    raw.tipo === 'motos' || raw.tipo === 'caminhoes' ? raw.tipo : 'carros';

  return {
    ...raw,
    ano,
    marca,
    combustivel,
    tipo,
    searchText: raw.searchText ?? normalizeText(raw.nome),
  };
}

async function loadShards(basePath: string): Promise<SearchIndexItem[] | null> {
  const manifestRes = await fetch(`${basePath}/manifest.json`);
  if (!manifestRes.ok) return null;

  const manifest = (await manifestRes.json()) as { shards: string[]; total: number };
  if (!manifest.total || !manifest.shards?.length) return null;

  const shardData = await Promise.all(
    manifest.shards.map((s) =>
      fetch(`${basePath}/shard-${s}.json`).then((r) => (r.ok ? r.json() : [])),
    ),
  );
  const flat = shardData.flat() as CompactShardItem[];
  return flat.map((item) => enrichIndexItem(expandCompact(item)));
}

async function loadSearchIndex(): Promise<SearchIndexItem[]> {
  const sources = ['/api/fipe/search', '/api/search'];

  for (const base of sources) {
    try {
      const fromShards = await loadShards(base);
      if (fromShards?.length) return fromShards;
    } catch {
      /* tenta proxima fonte */
    }
  }

  const res = await fetch('/api/busca-rapida.json');
  if (!res.ok) throw new Error('Falha ao carregar indice');
  const data = (await res.json()) as SearchIndexItem[];
  return data.map(enrichIndexItem);
}

let cachedIndex: SearchIndexItem[] | null = null;

export function useSearchIndex() {
  const [index, setIndex] = useState<SearchIndexItem[]>(cachedIndex ?? []);
  const [loading, setLoading] = useState(!cachedIndex);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedIndex) return;

    loadSearchIndex()
      .then((enriched) => {
        cachedIndex = enriched;
        setIndex(enriched);
      })
      .catch(() => setError('Não foi possível carregar o catálogo.'))
      .finally(() => setLoading(false));
  }, []);

  return { index, loading, error, total: index.length };
}

export function getMarcasFromIndex(index: SearchIndexItem[]): string[] {
  const marcas = new Set<string>();
  for (const item of index) {
    if (item.marca) marcas.add(marcaSlug(item.marca));
  }
  return [...marcas].sort();
}

export function getPopularItems(_index: SearchIndexItem[]): SearchIndexItem[] {
  return [];
}

export type { VehicleTipo };
