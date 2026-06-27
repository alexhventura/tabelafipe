import type { SeoMarca, SeoModelo } from '../lib/seo-data';

export const MARCA_EMBED_ID = '__MARCA_DATA__';
export const MODELO_EMBED_ID = '__MODELO_DATA__';

declare global {
  interface Window {
    __MARCA_DATA__?: SeoMarca;
    __MODELO_DATA__?: SeoModelo;
  }
}

function readEmbedJson<T>(id: string, windowKey: keyof Window): T | null {
  const fromWindow = window[windowKey] as T | undefined;
  if (fromWindow) return fromWindow;

  const el = document.getElementById(id);
  if (!el?.textContent) return null;

  try {
    const parsed = JSON.parse(el.textContent) as T;
    (window as unknown as Record<string, unknown>)[windowKey as string] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function peekEmbeddedMarca(expectedSlug?: string): SeoMarca | null {
  const data = readEmbedJson<SeoMarca>(MARCA_EMBED_ID, '__MARCA_DATA__');
  if (!data) return null;
  if (expectedSlug && data.slug !== expectedSlug) return null;
  return data;
}

export function peekEmbeddedModelo(
  marcaSlug?: string,
  modeloSlug?: string,
): SeoModelo | null {
  const data = readEmbedJson<SeoModelo>(MODELO_EMBED_ID, '__MODELO_DATA__');
  if (!data) return null;
  if (marcaSlug && data.marcaSlug !== marcaSlug) return null;
  if (modeloSlug && data.modeloSlug !== modeloSlug) return null;
  return data;
}

/** True when SSG already injected JSON-LD in document head. */
export function hasPrerenderJsonLd(): boolean {
  return Boolean(
    document.querySelector('head > script[type="application/ld+json"]:not([data-bundle-jsonld])'),
  );
}
