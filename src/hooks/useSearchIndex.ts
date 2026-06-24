import { useCallback, useEffect, useState } from 'react';
import { FamilySearchItem, SearchIndexItem, VehicleTipo } from '../types';
import { marcaSlug } from '../lib/slug';
import { normalizeText } from '../lib/modelFamily';
import { normalizeAnoModelo } from '../lib/displayYear';
import { ShardedCatalog } from '../lib/shardedCatalog';
import { FamilyCatalog } from '../lib/familyCatalog';

function enrichIndexItem(raw: SearchIndexItem): SearchIndexItem {
  const anoMatch = raw.nome.match(/\((\d{4})\)/);
  const anoParsed = normalizeAnoModelo(raw.ano);
  const ano = anoParsed ?? (anoMatch ? parseInt(anoMatch[1], 10) : undefined);

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
    searchText: raw.searchText ?? normalizeText(raw.modelo ? `${raw.marca} ${raw.modelo}` : raw.nome),
  };
}

let catalog: ShardedCatalog | null = null;
let familyCatalog: FamilyCatalog | null = null;
let flatFallback: SearchIndexItem[] | null = null;

async function loadFlatFallback(): Promise<SearchIndexItem[]> {
  const res = await fetch('/api/busca-rapida.json');
  if (!res.ok) throw new Error('Falha ao carregar indice');
  const data = (await res.json()) as SearchIndexItem[];
  return data.map(enrichIndexItem);
}

async function initCatalogMeta(): Promise<boolean> {
  if (catalog) return true;

  for (const base of ['/data/fipe/search', '/api/fipe/search', '/api/search']) {
    const cat = new ShardedCatalog(base);
    const ok = await cat.init();
    if (ok) {
      catalog = cat;
      const fam = new FamilyCatalog(base);
      const famOk = await fam.init();
      familyCatalog = famOk ? fam : null;
      return true;
    }
  }

  return false;
}

async function loadCatalogShards(): Promise<void> {
  if (!catalog) return;

  if (familyCatalog) {
    await familyCatalog.loadShard('c');
    await familyCatalog.loadShard('g');
    await familyCatalog.loadShard('s');
  }

  if ((catalog.total ?? 0) <= 500) {
    await catalog.loadAll();
  } else {
    await catalog.loadShard('c');
    await catalog.loadShard('g');
    await catalog.loadShard('s');
  }
}

function snapshotCatalog(): {
  index: SearchIndexItem[];
  families: FamilySearchItem[];
  total: number;
  totalFamilies: number;
} {
  if (flatFallback) {
    return {
      index: flatFallback,
      families: [],
      total: flatFallback.length,
      totalFamilies: 0,
    };
  }

  return {
    index: catalog?.getFlatIndex().map(enrichIndexItem) ?? [],
    families: familyCatalog?.getFlatIndex() ?? [],
    total: catalog?.total ?? 0,
    totalFamilies: familyCatalog?.total ?? 0,
  };
}

async function initCatalogFull(): Promise<{
  index: SearchIndexItem[];
  families: FamilySearchItem[];
  total: number;
  totalFamilies: number;
}> {
  const metaOk = await initCatalogMeta();
  if (metaOk) {
    await loadCatalogShards();
    return snapshotCatalog();
  }

  flatFallback = await loadFlatFallback();
  return snapshotCatalog();
}

let initMetaPromise: Promise<boolean> | null = null;
let initFullPromise: Promise<ReturnType<typeof snapshotCatalog>> | null = null;

function ensureCatalogMeta(): Promise<boolean> {
  if (catalog || flatFallback) return Promise.resolve(true);
  if (!initMetaPromise) {
    initMetaPromise = initCatalogMeta().finally(() => {
      initMetaPromise = null;
    });
  }
  return initMetaPromise;
}

function ensureCatalogFull(): Promise<ReturnType<typeof snapshotCatalog>> {
  if (cachedIndex) return Promise.resolve(snapshotCatalog());
  if (!initFullPromise) {
    initFullPromise = initCatalogFull()
      .then((result) => {
        cachedIndex = result.index;
        cachedFamilies = result.families;
        cachedTotal = result.total;
        cachedTotalFamilies = result.totalFamilies;
        return result;
      })
      .finally(() => {
        initFullPromise = null;
      });
  }
  return initFullPromise;
}

let cachedIndex: SearchIndexItem[] | null = null;
let cachedFamilies: FamilySearchItem[] | null = null;
let cachedTotal = 0;
let cachedTotalFamilies = 0;

export interface UseSearchIndexOptions {
  /** Evita carregar shards na montagem; ideal para a home quando o fluxo guiado é o principal. */
  lazy?: boolean;
}

function applySnapshot(
  snapshot: ReturnType<typeof snapshotCatalog>,
  setters: {
    setIndex: (v: SearchIndexItem[]) => void;
    setFamilies: (v: FamilySearchItem[]) => void;
    setTotal: (v: number) => void;
    setTotalFamilies: (v: number) => void;
  },
) {
  cachedIndex = snapshot.index;
  cachedFamilies = snapshot.families;
  cachedTotal = snapshot.total;
  cachedTotalFamilies = snapshot.totalFamilies;
  setters.setIndex(snapshot.index);
  setters.setFamilies(snapshot.families);
  setters.setTotal(snapshot.total);
  setters.setTotalFamilies(snapshot.totalFamilies);
}

export function useSearchIndex(options: UseSearchIndexOptions = {}) {
  const lazy = options.lazy ?? false;
  const [index, setIndex] = useState<SearchIndexItem[]>(cachedIndex ?? []);
  const [families, setFamilies] = useState<FamilySearchItem[]>(cachedFamilies ?? []);
  const [loading, setLoading] = useState(!cachedIndex && !lazy);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(cachedTotal || cachedIndex?.length || 0);
  const [totalFamilies, setTotalFamilies] = useState(cachedTotalFamilies);

  const syncFromCatalog = useCallback(() => {
    const snapshot = snapshotCatalog();
    applySnapshot(snapshot, { setIndex, setFamilies, setTotal, setTotalFamilies });
    return snapshot;
  }, []);

  const ensureIndexReady = useCallback(async () => {
    try {
      const metaOk = await ensureCatalogMeta();
      if (!metaOk && !flatFallback) {
        flatFallback = await loadFlatFallback();
      }
      syncFromCatalog();
    } catch {
      setError('Nao foi possivel carregar o catalogo.');
    }
  }, [syncFromCatalog]);

  const ensureShardsForQuery = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      try {
        await ensureIndexReady();
        const tasks: Promise<void>[] = [];
        if (catalog) tasks.push(catalog.loadForQuery(query));
        if (familyCatalog) tasks.push(familyCatalog.loadForQuery(query));
        if (!tasks.length) return;
        await Promise.all(tasks);
        syncFromCatalog();
      } catch {
        setError('Nao foi possivel carregar o catalogo.');
      }
    },
    [ensureIndexReady, syncFromCatalog],
  );

  useEffect(() => {
    if (cachedIndex) {
      setIndex(cachedIndex);
      setFamilies(cachedFamilies ?? []);
      setTotal(cachedTotal || cachedIndex.length);
      setTotalFamilies(cachedTotalFamilies);
      setLoading(false);
      return;
    }

    if (lazy) {
      setLoading(false);
      return;
    }

    ensureCatalogFull()
      .then((snapshot) => {
        applySnapshot(snapshot, { setIndex, setFamilies, setTotal, setTotalFamilies });
      })
      .catch(() => setError('Nao foi possivel carregar o catalogo.'))
      .finally(() => setLoading(false));
  }, [lazy]);

  return {
    index,
    families,
    loading,
    error,
    total: total || index.length,
    totalFamilies: totalFamilies || families.length,
    ensureShardsForQuery,
    ensureIndexReady,
  };
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
