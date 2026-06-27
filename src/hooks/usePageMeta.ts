import { useEffect } from 'react';
import { upsertLink, upsertMeta, upsertRobots, upsertSocialImages } from '../lib/metaDom';
import { DEFAULT_OG_IMAGE, DEFAULT_PAGE_TITLE, SITE_NAME, SITE_URL } from '../lib/siteMeta';

interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
  ogType?: string;
  ogImage?: string;
  noindex?: boolean;
  /** When false, hook is a no-op (for pages with dedicated SEO hooks). */
  enabled?: boolean;
}

export function usePageMeta({
  title,
  description,
  path = '/',
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
  noindex = false,
  enabled = true,
}: PageMetaOptions) {
  useEffect(() => {
    if (!enabled) return;

    const url = `${SITE_URL}${path}`;
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertLink('canonical', url);
    upsertRobots(!noindex);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', ogType);
    upsertMeta('property', 'og:locale', 'pt_BR');
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertSocialImages(ogImage);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:url', url);

    return () => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, [title, description, path, ogType, ogImage, noindex, enabled]);
}

export { SITE_URL };
