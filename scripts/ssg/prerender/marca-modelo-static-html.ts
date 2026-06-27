import { formatBRL } from '../../../src/lib/format.ts';
import { escapeHtml } from './html-utils.ts';
import type { SeoMarcaData, SeoModeloData } from './marca-modelo-seo.ts';

const MARCA_CLUSTERS = [
  'confiabilidade',
  'mais-vendidos',
  'problematicos',
  'manutencao',
  'comparacao',
] as const;

function seoBreadcrumbHtml(items: { label: string; href?: string }[]): string {
  const parts = items.map((item, i) => {
    const sep = i > 0 ? '<span aria-hidden="true">›</span>' : '';
    const inner = item.href
      ? `<a href="${escapeHtml(item.href)}" class="hover:text-blue-600 min-h-[44px] inline-flex items-center capitalize">${escapeHtml(item.label)}</a>`
      : `<span class="text-slate-700 dark:text-slate-300 font-medium min-h-[44px] inline-flex items-center capitalize">${escapeHtml(item.label)}</span>`;
    return `${sep}<span class="inline-flex items-center gap-1">${inner}</span>`;
  });
  return `<nav aria-label="Breadcrumb" class="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-1">${parts.join('')}</nav>`;
}

export function buildMarcaStaticMain(marca: SeoMarcaData): string {
  const clusterLinks = MARCA_CLUSTERS.map(
    (c) =>
      `<a href="/marca/${escapeHtml(marca.slug)}/${escapeHtml(c)}" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 min-h-[44px] inline-flex items-center capitalize">${escapeHtml(c.replace(/-/g, ' '))}</a>`,
  ).join('');

  const modelos = marca.modelos
    .map(
      (m) =>
        `<li>
  <a href="/modelo/${escapeHtml(marca.slug)}/${escapeHtml(m.slug)}" class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 min-h-[44px]">
    <span class="font-semibold text-sm">${escapeHtml(m.nome)}</span>
    <span class="text-xs text-slate-600 dark:text-slate-400 shrink-0">${m.totalVeiculos.toLocaleString('pt-BR')} versões</span>
  </a>
</li>`,
    )
    .join('');

  return `<div class="max-w-3xl mx-auto px-4 py-6 space-y-8" data-prerender="marca">
${seoBreadcrumbHtml([{ label: 'Início', href: '/' }, { label: marca.nome }])}
<header class="space-y-2">
  <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Tabela FIPE — ${escapeHtml(marca.nome)}</h1>
  <p class="text-sm text-slate-600 dark:text-slate-400">${marca.totalModelos.toLocaleString('pt-BR')} modelos · ${marca.totalVeiculos.toLocaleString('pt-BR')} veículos · ${escapeHtml(marca.tipo)}</p>
</header>
<nav class="flex flex-wrap gap-2 text-xs font-semibold" aria-label="Análises da marca">${clusterLinks}</nav>
<section class="space-y-3">
  <h2 class="text-lg font-bold">Modelos ${escapeHtml(marca.nome)}</h2>
  <ul class="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">${modelos}</ul>
</section>
<nav class="text-xs text-slate-600 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
  <a href="/" class="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">← Nova pesquisa</a>
  <a href="/comparar" class="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">Comparativos FIPE</a>
</nav>
</div>`;
}

export function buildModeloStaticMain(modelo: SeoModeloData): string {
  const displayName = `${modelo.marcaNome} ${modelo.modeloNome}`;
  const anos = modelo.anos ?? [];
  const anoLine =
    anos.length > 0 ? `${modelo.totalVeiculos} versões · Anos ${anos[0]}–${anos[anos.length - 1]}` : `${modelo.totalVeiculos} versões`;

  const versoes = [...modelo.versoes]
    .sort((a, b) => b.ano - a.ano)
    .map(
      (v) =>
        `<li>
  <a href="/fipe/${escapeHtml(modelo.marcaSlug)}/${escapeHtml(v.id)}" class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 min-h-[44px] text-sm">
    <span>${v.ano === 0 ? 'Zero KM' : v.ano} · ${escapeHtml(v.combustivel)}</span>
    <span class="font-semibold shrink-0 tabular-nums">${escapeHtml(formatBRL(v.valor))}</span>
  </a>
</li>`,
    )
    .join('');

  const historicoPlaceholder =
    modelo.historico.pontos.length > 1
      ? `<section class="space-y-3">
  <h2 class="text-lg font-bold">Evolução média de preço</h2>
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-h-[220px]" aria-hidden="true"></div>
</section>`
      : '';

  return `<div class="max-w-3xl mx-auto px-4 py-6 space-y-8" data-prerender="modelo">
${seoBreadcrumbHtml([
  { label: 'Início', href: '/' },
  { label: modelo.marcaNome, href: `/marca/${modelo.marcaSlug}` },
  { label: modelo.modeloNome },
])}
<header class="space-y-2">
  <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">${escapeHtml(displayName)} — Tabela FIPE</h1>
  <p class="text-sm text-slate-600 dark:text-slate-400">${escapeHtml(anoLine)}</p>
</header>
<div class="grid sm:grid-cols-2 gap-4 text-sm">
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
    <h2 class="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold">Resumo FIPE</h2>
    <div class="flex justify-between gap-4"><span class="text-slate-600 dark:text-slate-400">Menor preço</span><span class="font-semibold tabular-nums">${escapeHtml(formatBRL(modelo.historico.menorPreco ?? 0))}</span></div>
    <div class="flex justify-between gap-4"><span class="text-slate-600 dark:text-slate-400">Maior preço</span><span class="font-semibold tabular-nums">${escapeHtml(formatBRL(modelo.historico.maiorPreco ?? 0))}</span></div>
    <div class="flex justify-between gap-4"><span class="text-slate-600 dark:text-slate-400">Preço médio</span><span class="font-semibold tabular-nums">${escapeHtml(formatBRL(modelo.historico.valorMedio ?? 0))}</span></div>
  </div>
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
    <a href="/historico/${escapeHtml(modelo.marcaSlug)}/${escapeHtml(modelo.modeloSlug)}" class="text-blue-600 font-semibold text-sm min-h-[44px] inline-flex items-center">Ver histórico completo de preços →</a>
  </div>
</div>
${historicoPlaceholder}
<section class="space-y-3">
  <h2 class="text-lg font-bold">Versões e anos</h2>
  <ul class="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">${versoes}</ul>
</section>
<nav class="text-xs text-slate-600 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
  <a href="/marca/${escapeHtml(modelo.marcaSlug)}" class="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">← Todos os modelos ${escapeHtml(modelo.marcaNome)}</a>
  <a href="/historico/${escapeHtml(modelo.marcaSlug)}/${escapeHtml(modelo.modeloSlug)}" class="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">Histórico de preços</a>
</nav>
</div>`;
}
