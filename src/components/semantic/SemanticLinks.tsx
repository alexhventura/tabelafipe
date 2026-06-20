import { Link } from 'react-router-dom';
import {
  relatedIntentsFor,
  type SemanticIntent,
} from '../../lib/semantic';
import {
  clusterPath,
  compararPath,
  decisaoValeAPenaPath,
  historicoPath,
  modeloPath,
} from '../../lib/seo-routes';

export interface SemanticLinksProps {
  marcaSlug: string;
  modeloSlug: string;
  ano?: number;
  currentIntent?: SemanticIntent;
  title?: string;
}

export default function SemanticLinks({
  marcaSlug,
  modeloSlug,
  ano,
  currentIntent,
  title = 'Links semânticos',
}: SemanticLinksProps) {
  const intentLinks =
    ano != null ? relatedIntentsFor(marcaSlug, modeloSlug, ano, currentIntent) : [];

  const staticLinks = [
    { label: 'Página do modelo', href: modeloPath(marcaSlug, modeloSlug) },
    { label: 'Histórico FIPE', href: historicoPath(marcaSlug, modeloSlug) },
    { label: 'Comparativos', href: compararPath('') },
    { label: 'Cluster da marca', href: clusterPath(marcaSlug, 'comparacao') },
  ];

  if (ano != null) {
    staticLinks.unshift({
      label: 'Vale a pena comprar?',
      href: decisaoValeAPenaPath(marcaSlug, modeloSlug, ano),
    });
  }

  const links = [...intentLinks.slice(0, 6), ...staticLinks];

  return (
    <nav
      className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800"
      aria-label={title}
    >
      <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h2>
      <ul className="flex flex-wrap gap-2 text-xs font-semibold">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              to={link.href}
              className="inline-flex items-center min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-blue-600 capitalize"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
