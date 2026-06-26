import type { VehiclePageBundle } from '../../../src/types/bundle.ts';
import { formatBRL, formatPct } from '../../../src/lib/format.ts';
import { formatTitleCase, formatVehicleTitle, sanitizeDisplayText } from '../../../src/lib/display.ts';
import { getIdentityDisplayYear } from '../../../src/lib/displayYear.ts';
import {
  buildEnhancedFaq,
  buildQuickCards,
  buildSpecGroups,
  buildVehicleBreadcrumb,
  computeHistoricoStats,
  formatMesReferencia,
  pickConcorrentes,
} from '../../../src/lib/vehiclePageData.ts';
import { formatCompactSourcesLine } from '../../../src/lib/vehicleSources.ts';
import { breadcrumbHtml } from './static-brand.ts';
import { escapeHtml } from './html-utils.ts';

function sectionHtml(id: string, title: string, inner: string): string {
  return `<section id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-title" class="space-y-4 scroll-mt-20">
  <h2 id="${escapeHtml(id)}-title" class="text-lg font-bold text-slate-900 dark:text-white">${escapeHtml(title)}</h2>
  ${inner}
</section>`;
}

function specRowsHtml(rows: { label: string; value: string }[]): string {
  if (!rows.length) return '';
  const items = rows
    .map(
      (row) =>
        `<div class="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
  <dt class="text-slate-500">${escapeHtml(row.label)}</dt>
  <dd class="font-semibold text-right">${escapeHtml(row.value)}</dd>
</div>`,
    )
    .join('');
  return `<dl class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm divide-y divide-slate-100 dark:divide-slate-800">${items}</dl>`;
}

function relatedGridHtml(
  links: Array<{ canonicalPath: string; displayName: string; fipeCodigo: string; valorAtual: number; ano?: number }>,
): string {
  if (!links.length) return '';
  const items = links
    .map((item) => {
      const year = item.ano != null ? String(item.ano) : '';
      const meta = [year, year ? ' · ' : '', 'FIPE ', item.fipeCodigo].join('');
      return `<a href="${escapeHtml(item.canonicalPath)}" class="flex flex-col gap-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition-colors min-h-[56px]">
  <span class="text-sm font-semibold line-clamp-2">${escapeHtml(item.displayName)}</span>
  <span class="text-xs text-slate-500">${escapeHtml(meta)}</span>
  <span class="text-sm font-bold text-blue-600 tabular-nums">${escapeHtml(formatBRL(item.valorAtual))}</span>
</a>`;
    })
    .join('');
  return `<div class="grid gap-2 sm:grid-cols-2">${items}</div>`;
}

export function buildVehicleStaticMain(bundle: VehiclePageBundle): string {
  const { identity, fipe } = bundle;
  const breadcrumb = breadcrumbHtml(buildVehicleBreadcrumb(bundle));
  const historicoStats = computeHistoricoStats(fipe.historico);
  const quickCards = buildQuickCards(bundle);
  const specGroups = buildSpecGroups(bundle);
  const concorrentes = pickConcorrentes(bundle);
  const faqItems = buildEnhancedFaq(bundle);
  const sourcesLine = formatCompactSourcesLine(bundle);

  const variacao12m =
    historicoStats?.variacao12m ?? (fipe.trend6m != null ? fipe.trend6m * 2 : null);

  const pageTitle =
    formatTitleCase(sanitizeDisplayText(bundle.seo?.h1)) ||
    formatVehicleTitle(identity.displayName, identity);
  const identityYear = getIdentityDisplayYear(identity);
  const heroMetaLine = [
    formatTitleCase(identity.combustivel),
    identityYear.kind === 'zero_km' ? identityYear.label : identityYear.label ? `Ano ${identityYear.label}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const variacaoHtml =
    variacao12m != null
      ? `<p class="text-sm font-semibold ${variacao12m >= 0 ? 'text-emerald-300' : 'text-rose-300'}">${variacao12m >= 0 ? '▲' : '▼'} ${escapeHtml(formatPct(Math.abs(variacao12m)))} em 12 meses</p>`
      : '';

  const compareLink =
    concorrentes.length > 0
      ? `<a href="#sec-concorrentes" class="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold min-h-[40px] inline-flex items-center">Comparar</a>`
      : '';

  const canonicalUrl =
    bundle.seo?.canonical ??
    `https://pesquisatabelafipe.com.br${bundle.seo?.canonicalPath ?? ''}`;

  const sharePlaceholder = `<div class="[&_span]:text-slate-300 [&_button]:border-white/20 [&_button]:text-white [&_a]:border-white/20">
  <div class="flex items-center gap-2">
    <span class="text-xs text-slate-300 font-medium mr-1">Compartilhar</span>
    <span class="p-2.5 rounded-lg border border-white/20 min-w-[44px] min-h-[44px] inline-block" aria-hidden="true"></span>
    <a href="https://wa.me/?text=${encodeURIComponent(pageTitle)}%20${encodeURIComponent(canonicalUrl)}" target="_blank" rel="noopener noreferrer" class="p-2.5 rounded-lg border border-white/20 hover:border-green-500 transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-green-600" aria-label="Compartilhar no WhatsApp">
      <svg aria-hidden="true" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>
    <span class="p-2.5 rounded-lg border border-white/20 min-w-[44px] min-h-[44px] inline-block" aria-hidden="true"></span>
  </div>
</div>`;

  const heroHtml = `<header class="space-y-2">
  <div class="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 sm:p-5 space-y-3">
    <div class="space-y-0.5">
      <h1 class="text-lg sm:text-xl font-bold leading-snug line-clamp-2">${escapeHtml(pageTitle)}</h1>
      ${heroMetaLine ? `<p class="text-xs text-slate-300">${escapeHtml(heroMetaLine)}</p>` : ''}
    </div>
    <div class="space-y-1 border-t border-white/10 pt-3">
      <p class="text-[10px] uppercase tracking-wider text-slate-300 font-semibold">Preço FIPE</p>
      <p class="text-3xl sm:text-4xl font-bold tabular-nums leading-none">${escapeHtml(formatBRL(fipe.valorAtual))}</p>
      ${variacaoHtml}
      <p class="text-xs text-slate-300">FIPE ${escapeHtml(fipe.fipeCodigo)} · ${escapeHtml(formatMesReferencia(fipe.mesReferencia))}</p>
    </div>
    <div class="flex flex-wrap gap-2 pt-0.5">
      <a href="#sec-historico" class="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold min-h-[40px] inline-flex items-center">Histórico</a>
      ${compareLink}
      ${sharePlaceholder}
    </div>
  </div>
</header>`;

  let historicoSection = '';
  if (bundle.sections.historico && fipe.historico.length > 1 && historicoStats) {
    const insight = historicoStats.insight
      ? `<p class="text-sm text-slate-600 dark:text-slate-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3">${escapeHtml(historicoStats.insight)}</p>`
      : '';
    const statCell = (label: string, value: string) =>
      `<div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
  <p class="text-xs text-slate-500">${escapeHtml(label)}</p>
  <p class="font-bold tabular-nums">${escapeHtml(value)}</p>
</div>`;
    const grid = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
  ${historicoStats.variacao12m != null ? statCell('12 meses', formatPct(historicoStats.variacao12m)) : ''}
  ${historicoStats.variacao24m != null ? statCell('24 meses', formatPct(historicoStats.variacao24m)) : ''}
  ${statCell('Máxima', formatBRL(historicoStats.max))}
  ${statCell('Mínima', formatBRL(historicoStats.min))}
</div>`;
    historicoSection = sectionHtml(
      'sec-historico',
      'Histórico FIPE',
      `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-h-[220px]" aria-hidden="true"></div>${insight}${grid}`,
    );
  }

  let quickCardsSection = '';
  if (quickCards.length > 0) {
    const cards = quickCards
      .map(
        (card) =>
          `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 min-h-[72px] flex flex-col justify-center">
  <p class="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-semibold">${escapeHtml(card.label)}</p>
  <p class="text-sm font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-2">${escapeHtml(card.value)}</p>
</div>`,
      )
      .join('');
    quickCardsSection = sectionHtml(
      'sec-resumo',
      'Resumo rápido',
      `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${cards}</div>`,
    );
  }

  let specSection = '';
  if (specGroups.length > 0) {
    const groups = specGroups
      .map(
        (group) =>
          `<div class="space-y-2">
  <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(group.title)}</h3>
  ${specRowsHtml(group.rows)}
</div>`,
      )
      .join('');
    specSection = sectionHtml('sec-ficha', 'Ficha técnica', `<div class="space-y-4">${groups}</div>`);
  }

  let concorrentesSection = '';
  if (concorrentes.length > 0) {
    concorrentesSection = sectionHtml(
      'sec-concorrentes',
      'Concorrentes',
      `<p class="text-sm text-slate-500">Mesma categoria, faixa de preço e ano — marcas e modelos diferentes.</p>${relatedGridHtml(concorrentes)}`,
    );
  }

  const faqSection =
    faqItems.length > 0
      ? sectionHtml(
          'sec-faq',
          'Perguntas frequentes',
          `<div class="space-y-2">${faqItems
            .map(
              (item) =>
                `<details class="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
  <summary class="px-4 py-3 cursor-pointer font-semibold text-sm list-none flex justify-between items-center min-h-[44px]">${escapeHtml(item.pergunta)}<span class="text-slate-500 group-open:rotate-180 transition-transform" aria-hidden="true">▼</span></summary>
  <p class="px-4 pb-4 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(item.resposta)}</p>
</details>`,
            )
            .join('')}</div>`,
        )
      : '';

  const sourcesFooter = `<footer id="sec-fontes" class="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
  <p>Última atualização: ${escapeHtml(sourcesLine.atualizacao)}</p>
  <p class="leading-relaxed">Fontes: ${sourcesLine.fontes.map((f) => escapeHtml(f)).join(' · ')}</p>
</footer>`;

  const sections = `<div class="space-y-10">
${heroHtml}
${historicoSection}
${quickCardsSection}
${specSection}
${concorrentesSection}
${sourcesFooter}
${faqSection}
</div>`;

  return `<div class="max-w-3xl mx-auto px-4 py-3 sm:py-4 space-y-3" data-prerender="vehicle">
${breadcrumb}
${sections}
<nav class="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800">
  <a href="/" class="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">← Nova pesquisa</a>
</nav>
</div>`;
}
