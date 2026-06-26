import type { HistoricoPonto, VehiclePageBundle } from '../types/bundle';

export const VEHICLE_BUNDLE_EMBED_ID = '__VEHICLE_BUNDLE__';

export type VehicleUrlMapEntry = {
  bundlePath: string;
  canonicalPath: string;
  pageSlug: string;
};

let urlMapCache: Record<string, VehicleUrlMapEntry> | null = null;
let pageSlugIndex: Map<string, VehicleUrlMapEntry> | null = null;

async function loadUrlMap(): Promise<Record<string, VehicleUrlMapEntry>> {
  if (urlMapCache) return urlMapCache;
  try {
    const res = await fetch('/data/vehicle-url-map.json');
    if (res.ok) {
      urlMapCache = await res.json();
      pageSlugIndex = new Map();
      for (const entry of Object.values(urlMapCache!)) {
        if (entry.pageSlug) pageSlugIndex.set(entry.pageSlug, entry);
      }
      return urlMapCache!;
    }
  } catch {
    /* fallback below */
  }
  urlMapCache = {};
  pageSlugIndex = new Map();
  return urlMapCache;
}

declare global {
  interface Window {
    __VEHICLE_BUNDLE__?: VehiclePageBundle;
  }
}

export function peekEmbeddedVehicleBundle(): VehiclePageBundle | null {
  if (typeof window !== 'undefined' && window.__VEHICLE_BUNDLE__) {
    return window.__VEHICLE_BUNDLE__;
  }
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(VEHICLE_BUNDLE_EMBED_ID);
  if (!el?.textContent?.trim()) return null;
  try {
    return JSON.parse(el.textContent) as VehiclePageBundle;
  } catch {
    return null;
  }
}

export async function loadVehicleBundle(
  marcaSlug: string,
  slug: string,
): Promise<VehiclePageBundle | null> {
  const embedded = peekEmbeddedVehicleBundle();
  if (embedded) return embedded;

  const cleanSlug = slug.replace(/\/$/, '');
  const direct = `/data/bundles/${marcaSlug}/${cleanSlug}.json`;
  try {
    const res = await fetch(direct);
    if (res.ok) return (await res.json()) as VehiclePageBundle;
  } catch {
    /* try url map fallback */
  }

  await loadUrlMap();
  const entry = pageSlugIndex?.get(cleanSlug);
  if (entry?.bundlePath) {
    const res = await fetch(entry.bundlePath);
    if (res.ok) return (await res.json()) as VehiclePageBundle;
  }

  return null;
}

export async function loadFamilyHub(marcaSlug: string, familiaSlug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`/data/hubs/familia/${marcaSlug}/${familiaSlug}.json`);
    if (res.ok) return (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return null;
}

export function historicoToChartData(historico: HistoricoPonto[]): { mes: string; valor: number }[] {
  return historico.map((h) => ({
    mes: h.referencia ?? h.mes ?? '',
    valor: h.valor,
  }));
}
