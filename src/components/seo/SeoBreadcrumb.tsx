import { Link } from 'react-router-dom';

export interface BreadcrumbCrumb {
  label: string;
  to?: string;
}

interface SeoBreadcrumbProps {
  items: BreadcrumbCrumb[];
}

export default function SeoBreadcrumb({ items }: SeoBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-slate-500 flex flex-wrap items-center gap-1">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span aria-hidden>›</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-blue-600 min-h-[44px] inline-flex items-center capitalize">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-700 dark:text-slate-300 font-medium min-h-[44px] inline-flex items-center capitalize">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
