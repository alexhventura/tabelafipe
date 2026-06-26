import { Link, useLocation } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { INFO_PAGES } from '../content/infoPages';

export default function InfoPage() {
  const slug = useLocation().pathname.replace(/^\//, '').split('/')[0] ?? '';
  const page = INFO_PAGES[slug];

  usePageMeta({
    title: page ? `${page.title} — PesquisaTabelaFIPE` : 'Página não encontrada',
    description: page?.description ?? '',
    path: `/${slug}`,
    noindex: !page,
  });

  if (!page) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-lg font-semibold">Página não encontrada</p>
        <Link to="/" className="text-blue-600 text-sm font-semibold">
          ← Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-2xl mx-auto px-4 py-10 sm:py-14 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{page.title}</h1>
        <p className="text-sm text-slate-500">{page.description}</p>
      </header>
      {page.sections.map((section) => (
        <section key={section.heading ?? section.paragraphs[0].slice(0, 32)} className="space-y-3">
          {section.heading && (
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{section.heading}</h2>
          )}
          {section.paragraphs.map((p) => (
            <p key={p.slice(0, 48)} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {p}
            </p>
          ))}
        </section>
      ))}
      <p className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <Link to="/" className="text-sm font-semibold text-blue-600">
          ← Voltar ao início
        </Link>
      </p>
    </article>
  );
}
