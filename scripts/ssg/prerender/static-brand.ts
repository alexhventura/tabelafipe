export { buildBrandLogoHtml } from '../../../src/lib/brandHtml.ts';

export function breadcrumbHtml(items: { name: string; path?: string }[]): string {
  const parts = items.map((item, i) => {
    const isLast = i === items.length - 1;
    const inner = item.path && !isLast
      ? `<a href="${item.path}" class="hover:text-blue-600">${item.name}</a>`
      : `<span${isLast ? ' aria-current="page"' : ''}>${item.name}</span>`;
    return `<li class="inline">${inner}</li>`;
  });
  return `<nav aria-label="Breadcrumb" class="text-xs text-slate-500"><ol class="flex flex-wrap gap-1">${parts.join('<li class="inline text-slate-300" aria-hidden="true">/</li>')}</ol></nav>`;
}
