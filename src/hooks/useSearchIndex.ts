import { useCallback, useEffect, useState } from 'react';
import { SearchIndexItem, VehicleTipo } from '../types';
import { marcaSlug } from '../lib/slug';
import { normalizeText } from '../lib/search';
import { ShardedCatalog } from '../lib/shardedCatalog';

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

let catalog: ShardedCatalog | null = null;
let flatFallback: SearchIndexItem[] | null = null;

async function loadFlatFallback(): Promise<SearchIndexItem[]> {
  const res = await fetch('/api/busca-rapida.json');
  if (!res.ok) throw new Error('Falha ao carregar indice');
  const data = (await res.json()) as SearchIndexItem[];
  return data.map(enrichIndexItem);
}

async function initCatalog(): Promise<{ index: SearchIndexItem[]; total: number; catalog: ShardedCatalog | null }> {
  for (const base of ['/data/fipe/search', '/api/fipe/search', '/api/search']) {
    const cat = new ShardedCatalog(base);
    const ok = await cat.init();
    if (ok) {
      catalog = cat;
      const manifestTotal = cat.total;
      if (manifestTotal <= 500) {
        await cat.loadAll();
      } else {
        await cat.loadShard('a');
        await cat.loadShard('c');
        await cat.loadShard('v');
      }
      return { index: cat.getFlatIndex(), total: manifestTotal, catalog: cat };
    }
  }

  flatFallback = await loadFlatFallback();
  return { index: flatFallback, total: flatFallback.length, catalog: null };
}
let cachedIndex: SearchIndexItem[] | null = null;
let cachedTotal = 0;

export function useSearchIndex() {
  const [index, setIndex] = useState<SearchIndexItem[]>(cachedIndex ?? []);
  const [loading, setLoading] = useState(!cachedIndex);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(cachedTotal || cachedIndex?.length || 0);

  const ensureShardsForQuery = useCallback(async (query: string) => {
    if (!catalog) return;
    await catalog.loadForQuery(query);
    const next = catalog.getFlatIndex();
    cachedIndex = next;
    setIndex(next);
  }, []);

  useEffect(() => {
    if (cachedIndex) return;

    initCatalog()
      .then(({ index: enriched, total: t }) => {
        cachedIndex = enriched;
        cachedTotal = t;
        setIndex(enriched);
        setTotal(t);
      })
      .catch(() => setError('Nao foi possivel carregar o catalogo.'))
      .finally(() => setLoading(false));
  }, []);

  return { index, loading, error, total: total || index.length, ensureShardsForQuery };
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
