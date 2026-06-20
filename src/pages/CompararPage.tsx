import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import SeoBreadcrumb from '../components/seo/SeoBreadcrumb';
import ItemListJsonLd from '../components/seo/ItemListJsonLd';
import BreadcrumbJsonLd from '../components/vehicle/BreadcrumbJsonLd';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta, SITE_URL } from '../hooks/usePageMeta';
import { loadComparativo, loadComparativos } from '../lib/seo-data';
import type { SeoComparativoPar } from '../lib/seo-data';
import { formatBRL } from '../lib/format';
import { compararPath, modeloPath } from '../lib/seo-routes';

function ComparativoCard({ par }: { par: SeoComparativoPar }) {
  return (
    <Link
      to={compararPath(par.slug)}
      className="block border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-blue-500 transition-colors min-h-[44px]"
    >
      <p className="font-semibold text-sm capitalize">
        {par.a.modeloNome.split(' ').slice(0, 2).join(' ')} vs{' '}
        {par.b.modeloNome.split(' ').slice(0, 2).join(' ')}
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {formatBRL(par.a.valorMedio)} vs {formatBRL(par.b.valorMedio)} · {par.segmento}
      </p>
    </Link>
  );
}

function CompararDetail({ par, slug }: { par: SeoComparativoPar; slug: string }) {
  const { index } = useSearchIndex();
  const path = compararPath(slug);
  const titulo = `${par.a.marcaNome} ${par.a.modeloNome.split(' ')[0]} vs ${par.b.marcaNome} ${par.b.modeloNome.split(' ')[0]}`;

  usePageMeta({
    title: `${titulo} — Comparativo FIPE`,
    description: `Compare preços FIPE: ${par.a.modeloNome} (${formatBRL(par.a.valorMedio)}) vs ${par.b.modeloNome} (${formatBRL(par.b.valorMedio)}).`,
    path,
    ogType: 'article',
  });

  const resumo =
    par.a.valorMedio <= par.b.valorMedio
      ? `${par.a.modeloNome} tem preço médio menor: ${formatBRL(par.a.valorMedio)} vs ${formatBRL(par.b.valorMedio)}.`
      : `${par.b.modeloNome} tem preço médio menor: ${formatBRL(par.b.valorMedio)} vs ${formatBRL(par.a.valorMedio)}.`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: 'Comparar', href: `${SITE_URL}/comparar` },
          { name: titulo, href: `${SITE_URL}${path}` },
        ]}
      />

      <SearchBox index={index} size="compact" showTabs={false} />

      <SeoBreadcrumb
        items={[
          { label: 'Início', to: '/' },
          { label: 'Comparar', to: '/comparar' },
          { label: titulo },
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white capitalize">
          {titulo}
        </h1>
        <p className="text-sm text-slate-500">Segmento: {par.segmento}</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {[par.a, par.b].map((side) => (
          <div
            key={side.modeloSlug}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <h2 className="font-bold text-sm">{side.marcaNome}</h2>
            <p className="text-sm">{side.modeloNome}</p>
            <p className="text-2xl font-bold text-blue-600">{formatBRL(side.valorMedio)}</p>
            <p className="text-xs text-slate-500">{side.totalVeiculos} versões indexadas</p>
            <Link
              to={modeloPath(side.marcaSlug, side.modeloSlug)}
              className="text-blue-600 text-sm font-semibold inline-flex min-h-[44px] items-center"
            >
              Ver modelo →
            </Link>
          </div>
        ))}
      </div>

      <section className="text-sm space-y-2">
        <h2 className="text-lg font-bold">Resumo</h2>
        <p className="text-slate-600 dark:text-slate-400">{resumo}</p>
      </section>

      <nav className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800">
        <Link to="/comparar" className="text-blue-600 font-semibold">
          ← Outros comparativos
        </Link>
      </nav>
    </div>
  );
}

function CompararIndex({ pares }: { pares: SeoComparativoPar[] }) {
  const { index } = useSearchIndex();

  usePageMeta({
    title: 'Comparativos FIPE — carros rivais lado a lado',
    description: 'Compare preços FIPE entre modelos rivais: Onix vs HB20, Civic vs Corolla e mais.',
    path: '/comparar',
  });

  const listItems = pares.slice(0, 40).map((p) => ({
    name: p.slug,
    url: `${SITE_URL}${compararPath(p.slug)}`,
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <ItemListJsonLd name="Comparativos FIPE" items={listItems} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: 'Comparar', href: `${SITE_URL}/comparar` },
        ]}
      />

      <SearchBox index={index} size="compact" showTabs={false} />

      <SeoBreadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Comparar' }]} />

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Comparativos FIPE
        </h1>
        <p className="text-sm text-slate-500">{pares.length} pares de modelos rivais</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        {pares.map((p) => (
          <div key={p.slug}>
            <ComparativoCard par={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompararPage() {
  const { slug } = useParams();
  const [pares, setPares] = useState<SeoComparativoPar[]>([]);
  const [par, setPar] = useState<SeoComparativoPar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (slug) {
      loadComparativo(slug).then((p) => {
        setPar(p);
        setLoading(false);
      });
    } else {
      loadComparativos().then((list) => {
        setPares(list);
        setLoading(false);
      });
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm" role="status">
        Carregando...
      </div>
    );
  }

  if (slug) {
    if (!par) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
          <p className="text-lg font-semibold">Comparativo não encontrado</p>
          <Link to="/comparar" className="text-blue-600 text-sm font-semibold">
            ← Ver comparativos
          </Link>
        </div>
      );
    }
    return <CompararDetail par={par} slug={slug} />;
  }

  return <CompararIndex pares={pares} />;
}
