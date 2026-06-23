import { Link } from 'react-router-dom';
import BrandLogo from '../brand/BrandLogo';
import { FOOTER_LINKS, LEGAL_DISCLAIMER, SITE_DOMAIN, SITE_VERSION } from '../../lib/siteMeta';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
          <BrandLogo size="sm" asLink />

          <nav aria-label="Links institucionais" className="grid grid-cols-2 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors min-h-[36px] inline-flex items-center"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">{LEGAL_DISCLAIMER}</p>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <p>
            © {year} {SITE_DOMAIN}
          </p>
          <p>
            Versão {SITE_VERSION} · Tabela FIPE de referência
          </p>
        </div>
      </div>
    </footer>
  );
}
