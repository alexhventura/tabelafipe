import type { VehiclePageBundle } from '../../../src/types/bundle.ts';
import { wrapInAppShell } from '../../../src/lib/staticShellHtml.ts';
import { buildInlineVehicleShellScriptTag } from '../../../src/lib/inlineVehicleShellScript.ts';
import { buildVehicleStaticMain } from './vehicle-static-html.ts';

export const VEHICLE_BUNDLE_EMBED_ID = '__VEHICLE_BUNDLE__';

export { wrapInAppShell } from '../../../src/lib/staticShellHtml.ts';

export interface PrerenderSeo {
  title: string;
  description: string;
  canonical?: string;
  og?: Record<string, string>;
  twitter?: Record<string, string>;
  jsonLd?: Record<string, unknown>[];
}

import { escapeHtml } from './html-utils.ts';

export { escapeHtml } from './html-utils.ts';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildHeadExtras(seo: PrerenderSeo): string {
  const lines: string[] = [
    '<meta name="generator" content="spa-prerender" />',
    '<meta name="robots" content="index, follow" />',
  ];
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

export interface PrerenderHtmlOptions {
  embedJson?: { id: string; data: unknown };
}

function buildVehicleBundleEmbedScripts(id: string, data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/json" id="${id}">${json}</script>
    <script>
      (function () {
        var el = document.getElementById(${JSON.stringify(id)});
        if (!el || !el.textContent) return;
        try {
          window[${JSON.stringify(id)}] = JSON.parse(el.textContent);
        } catch (e) {}
        var prerender = document.querySelector('[data-prerender="vehicle"]');
        if (prerender) {
          var h = prerender.offsetHeight;
          if (h > 0) {
            document.documentElement.style.setProperty('--vehicle-prerender-min-h', h + 'px');
            var main = prerender.closest('main');
            if (main) main.style.minHeight = h + 'px';
          }
        }
      })();
    </script>`;
}

export function buildPrerenderedHtml(
  baseHtml: string,
  seo: PrerenderSeo,
  bodyHtml: string,
  options?: PrerenderHtmlOptions,
): string {
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

  const inlineShell = buildInlineVehicleShellScriptTag();
  const beforeModule = `${inlineShell}\n    `;

  if (options?.embedJson) {
    const embedScripts = buildVehicleBundleEmbedScripts(options.embedJson.id, options.embedJson.data);
    html = html.replace('<script type="module"', `${beforeModule}${embedScripts}\n    <script type="module"`);
  } else {
    html = html.replace('<script type="module"', `${beforeModule}<script type="module"`);
  }

  return html;
}

export function canonicalPathToOutFile(distDir: string, canonicalPath: string): string {
  const clean = canonicalPath.replace(/\/+$/, '').replace(/^\//, '');
  return `${distDir}/${clean}/index.html`;
}

export function buildVehicleBody(bundle: VehiclePageBundle): string {
  return wrapInAppShell(buildVehicleStaticMain(bundle));
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

  const content = `<div class="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6" data-prerender="familia-hub">
  <article class="space-y-4">
    <h1 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">${escapeHtml(h1)}</h1>
    ${hub.descricao ? `<p class="text-sm text-slate-600 dark:text-slate-300">${escapeHtml(hub.descricao)}</p>` : ''}
    ${hub.seo?.description ? `<p class="text-sm text-slate-600 dark:text-slate-300">${escapeHtml(hub.seo.description)}</p>` : ''}
    ${vehicles ? `<section aria-label="Versões" class="space-y-3"><h2 class="text-lg font-bold">Versões e anos</h2><ul class="space-y-2 text-sm">${vehicles}</ul></section>` : ''}
  </article>
</div>`;
  return wrapInAppShell(content);
}

export function buildInfoBody(title: string, description: string, paragraphs: string[]): string {
  const body = paragraphs.map((p) => `<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(p)}</p>`).join('');
  const content = `<div class="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-4" data-prerender="info">
  <article class="space-y-4">
    <h1 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">${escapeHtml(title)}</h1>
    <p class="text-sm text-slate-600 dark:text-slate-300">${escapeHtml(description)}</p>
    ${body}
  </article>
</div>`;
  return wrapInAppShell(content);
}

export function buildHomeBody(): string {
  const content = `<div class="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-4" data-prerender="home">
  <article class="space-y-4">
    <h1 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Tabela FIPE Completa</h1>
    <p class="text-sm text-slate-600 dark:text-slate-300">Consulte preços FIPE, histórico, ficha técnica, consumo, manutenção, segurança e informações completas do seu veículo.</p>
    <p class="text-sm text-slate-600 dark:text-slate-300">Busque por marca, modelo, versão, ano ou código FIPE.</p>
  </article>
</div>`;
  return wrapInAppShell(content, { hideHeader: true });
}
