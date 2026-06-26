/** HTML estático da marca (SSG + shell parcial no cliente). */

const CAR_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';

const sizes = {
  sm: { box: 'w-8 h-8', icon: 'w-4 h-4', title: 'text-sm', sub: 'text-[9px]' },
  md: { box: 'w-10 h-10', icon: 'w-5 h-5', title: 'text-base', sub: 'text-[10px]' },
  lg: { box: 'w-14 h-14', icon: 'w-7 h-7', title: 'text-xl sm:text-2xl', sub: 'text-xs' },
} as const;

export function buildBrandLogoHtml(size: keyof typeof sizes = 'sm', options?: { asLink?: boolean }): string {
  const s = sizes[size];
  const asLink = options?.asLink !== false;
  const inner = `<div class="inline-flex items-center gap-3">
  <div class="${s.box} rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/20 shrink-0">
    <span class="${s.icon} inline-flex">${CAR_ICON_SVG}</span>
  </div>
  <div class="text-left">
    <span class="${s.title} font-bold text-slate-900 dark:text-white leading-tight block">Pesquisa<span class="text-blue-600">Tabela</span>FIPE</span>
    ${size === 'lg' ? `<span class="${s.sub} text-slate-500 dark:text-slate-400 font-medium block">Portal automotivo de confiança</span>` : ''}
  </div>
</div>`;

  if (asLink) {
    return `<a href="/" class="group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">${inner}</a>`;
  }
  return inner;
}
