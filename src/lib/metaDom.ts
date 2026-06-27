export function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function upsertRobots(index: boolean) {
  upsertMeta('name', 'robots', index ? 'index, follow' : 'noindex, nofollow');
}

export function upsertSocialImages(imageUrl: string) {
  upsertMeta('property', 'og:image', imageUrl);
  upsertMeta('property', 'og:image:alt', 'Pesquisa Tabela FIPE — consulta de preços e dados de veículos');
  upsertMeta('name', 'twitter:image', imageUrl);
}
