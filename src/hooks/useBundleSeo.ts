import { useEffect } from 'react';
import type { VehiclePageSeo } from '../types/bundle';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function useBundleSeo(seo: VehiclePageSeo | null, extraJsonLd: Record<string, unknown>[] = []) {
  useEffect(() => {
    if (!seo) return;

    document.title = seo.title;
    upsertMeta('name', 'description', seo.description);
    upsertLink('canonical', seo.canonical);

    for (const [key, value] of Object.entries(seo.og)) {
      upsertMeta('property', key, value);
    }
    for (const [key, value] of Object.entries(seo.twitter)) {
      upsertMeta('name', key, value);
    }

    const existing = document.querySelectorAll('script[data-bundle-jsonld]');
    existing.forEach((el) => el.remove());

    const blocks = [...seo.jsonLd.filter((b) => (b as { '@type'?: string })['@type'] !== 'FAQPage'), ...extraJsonLd];

    for (const block of blocks) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-bundle-jsonld', '1');
      script.textContent = JSON.stringify(block);
      document.head.appendChild(script);
    }

    return () => {
      document.querySelectorAll('script[data-bundle-jsonld]').forEach((el) => el.remove());
    };
  }, [seo, extraJsonLd]);
}
