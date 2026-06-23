import { Link, useLocation } from 'react-router-dom';
import BrandLogo from '../brand/BrandLogo';

export default function Header() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;

  return (
    <header className="border-b border-slate-200/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <BrandLogo size="sm" />
        <Link
          to="/"
          className="text-xs font-semibold text-slate-500 hover:text-blue-600 min-h-[44px] inline-flex items-center"
        >
          Nova busca
        </Link>
      </div>
    </header>
  );
}
