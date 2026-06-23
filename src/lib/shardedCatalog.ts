import { SearchIndexItem, VehicleTipo } from '../types';
import { normalizeText } from './search';

export interface ShardManifest {
  shards: string[];
  total: number;
  geradoEm?: string;
  path?: string;
}

interface CompactShardItem {
  i: string;
  n: string;
  m: string;
  a: number;
  v: number;
  t: VehicleTipo;
  c?: string;
  s: string;
  p?: string;
  f?: string;
  cp?: string;
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
    dataPath: item.p,
    fipeCodigo: item.f,
    canonicalPath: item.cp,
  };
}

export class ShardedCatalog {
  readonly basePath: string;
  manifest: ShardManifest | null = null;
  private loaded = new Map<string, SearchIndexItem[]>();
  private loading = new Map<string, Promise<void>>();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  get total(): number {
    return this.manifest?.total ?? this.getFlatIndex().length;
  }

  getFlatIndex(): SearchIndexItem[] {
    const out: SearchIndexItem[] = [];
    for (const items of this.loaded.values()) out.push(...items);
    return out;
  }

  async init(): Promise<boolean> {
    const res = await fetch(`${this.basePath}/manifest.json`);
    if (!res.ok) return false;
    this.manifest = (await res.json()) as ShardManifest;
    return (this.manifest.total ?? 0) > 0;
  }

  async loadShard(key: string): Promise<void> {
    if (this.loaded.has(key)) return;
    const pending = this.loading.get(key);
    if (pending) return pending;

    const promise = (async () => {
      const res = await fetch(`${this.basePath}/shard-${key}.json`);
      if (!res.ok) return;
      const data = (await res.json()) as CompactShardItem[];
      this.loaded.set(key, data.map(expandCompact));
    })();

    this.loading.set(key, promise);
    await promise;
    this.loading.delete(key);
  }

  shardKeysForQuery(query: string): string[] {
    const keys = new Set<string>();
    const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const c = t[0];
      if (c && /[a-z]/.test(c)) keys.add(c);
    }
    if (!keys.size) return this.manifest?.shards?.slice(0, 3) ?? ['a', 'c', 'v'];
    return [...keys];
  }

  async loadForQuery(query: string): Promise<void> {
    if (!this.manifest?.shards?.length) return;
    const norm = normalizeText(query);
    if (norm.length === 1 && /[a-z]/.test(norm)) {
      await this.loadShard(norm);
      return;
    }
    const keys = this.shardKeysForQuery(query);
    await Promise.all(keys.map((k) => this.loadShard(k)));
  }

  async loadAll(progress?: (loaded: number, total: number) => void): Promise<void> {
    if (!this.manifest?.shards?.length) return;
    const shards = this.manifest.shards;
    const batch = 6;
    for (let i = 0; i < shards.length; i += batch) {
      await Promise.all(shards.slice(i, i + batch).map((k) => this.loadShard(k)));
      progress?.(Math.min(i + batch, shards.length), shards.length);
    }
  }
}
