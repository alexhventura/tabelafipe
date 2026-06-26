/** Header/footer estáticos compartilhados entre SSG e fallback no cliente. */
import { FOOTER_LINKS, LEGAL_DISCLAIMER, SITE_DOMAIN, SITE_VERSION } from './siteMeta';
import { buildBrandLogoHtml } from './brandHtml';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildStaticHeaderHtml(): string {
  return `<header class="border-b border-slate-200/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-50">
  <div class="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
    ${buildBrandLogoHtml('sm')}
    <a href="/" class="text-xs font-semibold text-slate-500 hover:text-blue-600 min-h-[44px] inline-flex items-center">Nova busca</a>
  </div>
</header>`;
}

export function buildStaticFooterHtml(year: number): string {
  const links = FOOTER_LINKS.map(
    (link) =>
      `<a href="${escapeHtml(link.path)}" class="text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors min-h-[36px] inline-flex items-center">${escapeHtml(link.label)}</a>`,
  ).join('');

  return `<footer class="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
  <div class="max-w-5xl mx-auto px-4 py-10 sm:py-12 space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
      ${buildBrandLogoHtml('sm')}
      <nav aria-label="Links institucionais" class="grid grid-cols-2 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">${links}</nav>
    </div>
    <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">${escapeHtml(LEGAL_DISCLAIMER)}</p>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
      <p>© ${year} ${escapeHtml(SITE_DOMAIN)}</p>
      <p>Versão ${escapeHtml(SITE_VERSION)} · Tabela FIPE de referência</p>
    </div>
  </div>
</footer>`;
}

export interface AppShellOptions {
  hideHeader?: boolean;
}

export function wrapInAppShell(mainContent: string, options?: AppShellOptions): string {
  const year = new Date().getFullYear();
  const header = options?.hideHeader ? '' : buildStaticHeaderHtml();
  return `<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-x-hidden">
${header}
<main class="flex-1 w-full">
${mainContent}
</main>
${buildStaticFooterHtml(year)}
</div>`;
}
