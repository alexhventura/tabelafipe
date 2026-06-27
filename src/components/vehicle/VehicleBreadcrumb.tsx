import { Link } from 'react-router-dom';
import BreadcrumbJsonLd from './BreadcrumbJsonLd';
import { SITE_URL } from '../../hooks/usePageMeta';

export interface BreadcrumbCrumb {
  name: string;
  path?: string;
}

interface Props {
  items: BreadcrumbCrumb[];
  /** When false, skip JSON-LD (e.g. vehicle pages already ship BreadcrumbList in bundle SEO). */
  jsonLd?: boolean;
}

export default function VehicleBreadcrumb({ items, jsonLd = true }: Props) {
  const jsonLdItems = items.map((item) => ({
    name: item.name,
    href: item.path ? `${SITE_URL}${item.path}` : undefined,
  }));

  return (
    <>
      {jsonLd && <BreadcrumbJsonLd items={jsonLdItems} />}
      <nav aria-label="Breadcrumb" className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-y-0.5">
        {items.map((crumb, i) => (
          <span key={`${crumb.name}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-slate-300 px-0.5" aria-hidden>&gt;</span>}
            {crumb.path && i < items.length - 1 ? (
              <Link
                to={crumb.path}
                className="hover:text-blue-600 min-h-[32px] sm:min-h-[36px] inline-flex items-center capitalize"
              >
                {crumb.name}
              </Link>
            ) : (
              <span className="text-slate-700 dark:text-slate-300 font-medium min-h-[32px] sm:min-h-[36px] inline-flex items-center line-clamp-1">
                {crumb.name}
              </span>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}
