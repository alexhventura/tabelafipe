export interface PrerenderSeo {
  title: string;
  description: string;
  canonical?: string;
  og?: Record<string, string>;
  twitter?: Record<string, string>;
  jsonLd?: Record<string, unknown>[];
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildHeadExtras(seo: PrerenderSeo): string {
  const lines: string[] = ['<meta name="generator" content="spa-prerender" />'];
  if (seo.canonical) {
    lines.push(`<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`);
  }
  for (const [key, value] of Object.entries(seo.og ?? {})) {
    lines.push(`<meta property="${escapeHtml(key)}" content="${escapeHtml(value)}" />`);
  }
  for (const [key, value] of Object.entries(seo.twitter ?? {})) {
    lines.push(`<meta name="${escapeHtml(key)}" content="${escapeHtml(value)}" />`);
  }
  for (const block of seo.jsonLd ?? []) {
    lines.push(`<script type="application/ld+json">${JSON.stringify(block)}</script>`);
  }
  return lines.join('\n    ');
}

export function buildPrerenderedHtml(baseHtml: string, seo: PrerenderSeo, bodyHtml: string): string {
  let html = baseHtml;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(seo.description)}" />`,
  );

  html = html.replace('</head>', `    ${buildHeadExtras(seo)}\n  </head>`);
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${bodyHtml}</div>`,
  );

  return html;
}

export function canonicalPathToOutFile(distDir: string, canonicalPath: string): string {
  const clean = canonicalPath.replace(/\/+$/, '').replace(/^\//, '');
  return `${distDir}/${clean}/index.html`;
}

interface VehicleBundleLike {
  seo: PrerenderSeo & { h1?: string; breadcrumb?: { name: string; path: string }[] };
  identity: {
    marca: string;
    displayName: string;
    combustivel: string;
    displayYear?: { label: string };
  };
  fipe: {
    fipeCodigo: string;
    valorAtual: number;
    referencia?: string;
  };
  faq?: { pergunta: string; resposta: string }[];
}

export function buildVehicleBody(bundle: VehicleBundleLike): string {
  const h1 = bundle.seo.h1 ?? bundle.identity.displayName;
  const valor = formatBRL(bundle.fipe.valorAtual);
  const year = bundle.identity.displayYear?.label ?? '';
  const breadcrumb = (bundle.seo.breadcrumb ?? [])
    .map((item) => `<li>${escapeHtml(item.name)}</li>`)
    .join('');

  const faq = (bundle.faq ?? [])
    .slice(0, 6)
    .map(
      (item) =>
        `<details><summary>${escapeHtml(item.pergunta)}</summary><p>${escapeHtml(item.resposta)}</p></details>`,
    )
    .join('');

  return `<main data-prerender="vehicle">
  <article>
    ${breadcrumb ? `<nav aria-label="Breadcrumb"><ol>${breadcrumb}</ol></nav>` : ''}
    <h1>${escapeHtml(h1)}</h1>
    <p><strong>Preço FIPE:</strong> ${escapeHtml(valor)}</p>
    <p><strong>Código FIPE:</strong> ${escapeHtml(bundle.fipe.fipeCodigo)}</p>
    <p><strong>Combustível:</strong> ${escapeHtml(bundle.identity.combustivel)}${year ? ` · <strong>Ano:</strong> ${escapeHtml(year)}` : ''}</p>
    ${bundle.fipe.referencia ? `<p><strong>Referência:</strong> ${escapeHtml(bundle.fipe.referencia)}</p>` : ''}
    <p>${escapeHtml(bundle.seo.description)}</p>
    ${faq ? `<section aria-label="Perguntas frequentes"><h2>Perguntas frequentes</h2>${faq}</section>` : ''}
  </article>
</main>`;
}

interface FamilyHubLike {
  titulo?: string;
  descricao?: string;
  seo?: PrerenderSeo & { h1?: string };
  veiculos?: Array<{
    displayName: string;
    valorAtual: number;
    ano: number;
    canonicalPath: string;
  }>;
}

export function buildFamilyHubBody(hub: FamilyHubLike): string {
  const h1 = hub.seo?.h1 ?? hub.titulo ?? 'Tabela FIPE';
  const vehicles = (hub.veiculos ?? [])
    .slice(0, 24)
    .map(
      (v) =>
        `<li><a href="${escapeHtml(v.canonicalPath)}">${escapeHtml(v.displayName)} (${v.ano}) — ${escapeHtml(formatBRL(v.valorAtual))}</a></li>`,
    )
    .join('');

  return `<main data-prerender="familia-hub">
  <article>
    <h1>${escapeHtml(h1)}</h1>
    ${hub.descricao ? `<p>${escapeHtml(hub.descricao)}</p>` : ''}
    ${hub.seo?.description ? `<p>${escapeHtml(hub.seo.description)}</p>` : ''}
    ${vehicles ? `<section aria-label="Versões"><h2>Versões e anos</h2><ul>${vehicles}</ul></section>` : ''}
  </article>
</main>`;
}

export function buildInfoBody(title: string, description: string, paragraphs: string[]): string {
  const body = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  return `<main data-prerender="info">
  <article>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    ${body}
  </article>
</main>`;
}

export function buildHomeBody(): string {
  return `<main data-prerender="home">
  <article>
    <h1>Tabela FIPE Completa</h1>
    <p>Consulte preços FIPE, histórico, ficha técnica, consumo, manutenção, segurança e informações completas do seu veículo.</p>
    <p>Busque por marca, modelo, versão, ano ou código FIPE.</p>
  </article>
</main>`;
}
