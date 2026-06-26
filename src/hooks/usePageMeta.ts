import { useEffect } from 'react';
import { upsertLink, upsertMeta, upsertRobots } from '../lib/metaDom';
import { DEFAULT_PAGE_TITLE, SITE_NAME, SITE_URL } from '../lib/siteMeta';

interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
  ogType?: string;
  noindex?: boolean;
}

export function usePageMeta({
  title,
  description,
  path = '/',
  ogType = 'website',
  noindex = false,
}: PageMetaOptions) {
  useEffect(() => {
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
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    return () => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, [title, description, path, ogType, noindex]);
}

export { SITE_URL };
