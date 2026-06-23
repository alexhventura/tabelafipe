import type { FamilySearchItem, VehicleTipo } from '../types';
import { normalizeText } from './modelFamily';

export interface FamilyManifest {
  total: number;
  shards: string[];
  geradoEm?: string;
  path?: string;
}

interface CompactFamily {
  id: string;
  fa: string;
  fd: string;
  m: string;
  md: string;
  t: VehicleTipo;
  n: number;
  vmin: number;
  vmax: number;
  amin: number;
  amax: number;
  cp?: string;
}

function expandFamily(row: CompactFamily): FamilySearchItem {
  return {
    id: row.id,
    familia: row.fa,
    familiaDisplay: row.fd,
    marca: row.md,
    marcaSlug: row.m,
    tipo: row.t,
    versaoCount: row.n,
    valorMin: row.vmin,
    valorMax: row.vmax,
    anoMin: row.amin,
    anoMax: row.amax,
    hubPath: row.cp,
  };
}

export class FamilyCatalog {
  readonly basePath: string;
  manifest: FamilyManifest | null = null;
  private loaded = new Map<string, FamilySearchItem[]>();
  private loading = new Map<string, Promise<void>>();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  get total(): number {
    return this.manifest?.total ?? this.getFlatIndex().length;
  }

  getFlatIndex(): FamilySearchItem[] {
    const out: FamilySearchItem[] = [];
    for (const items of this.loaded.values()) out.push(...items);
    return out;
  }

  async init(): Promise<boolean> {
    const res = await fetch(`${this.basePath}/families-manifest.json`);
    if (!res.ok) return false;
    this.manifest = (await res.json()) as FamilyManifest;
    return (this.manifest.total ?? 0) > 0;
  }

  async loadShard(key: string): Promise<void> {
    if (this.loaded.has(key)) return;
    const pending = this.loading.get(key);
    if (pending) return pending;

    const promise = (async () => {
      const res = await fetch(`${this.basePath}/family-shard-${key}.json`);
      if (!res.ok) return;
      const data = (await res.json()) as CompactFamily[];
      this.loaded.set(key, data.map(expandFamily));
    })();

    this.loading.set(key, promise);
    await promise;
    this.loading.delete(key);
  }

  async loadForQuery(query: string): Promise<void> {
    if (!this.manifest?.shards?.length) return;
    const norm = normalizeText(query);
    if (!norm) return;
    const letter = norm[0];
    if (letter && /[a-z]/.test(letter)) {
      await this.loadShard(letter);
    }
  }
}
