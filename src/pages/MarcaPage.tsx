import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import SeoBreadcrumb from '../components/seo/SeoBreadcrumb';
import ItemListJsonLd from '../components/seo/ItemListJsonLd';
import BreadcrumbJsonLd from '../components/vehicle/BreadcrumbJsonLd';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta, SITE_URL } from '../hooks/usePageMeta';
import { loadMarca } from '../lib/seo-data';
import type { SeoMarca } from '../lib/seo-data';
import { historicoPath, modeloPath, clusterPath } from '../lib/seo-routes';
import { MARCA_CLUSTER_TYPES } from '../lib/semantic';
import { useParams } from 'react-router-dom';

export default function MarcaPage() {
  const { marcaSlug = '' } = useParams();
  const { index } = useSearchIndex();
  const [marca, setMarca] = useState<SeoMarca | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadMarca(marcaSlug).then((m) => {
      setMarca(m);
      setLoading(false);
    });
  }, [marcaSlug]);

  const path = `/marca/${marcaSlug}`;
  const title = marca
    ? `Tabela FIPE ${marca.nome} — ${marca.totalModelos} modelos, ${marca.totalVeiculos.toLocaleString('pt-BR')} veículos`
    : 'Marca não encontrada';

  usePageMeta({
    title: `${title} | PesquisaTabelaFIPE`,
    description: marca
      ? `Consulte preços FIPE de todos os modelos ${marca.nome}. ${marca.totalVeiculos.toLocaleString('pt-BR')} versões indexadas.`
      : 'Marca não encontrada.',
    path,
    noindex: !loading && !marca,
  });

  const listItems = useMemo(
    () =>
      (marca?.modelos ?? []).slice(0, 50).map((m) => ({
        name: m.nome,
        url: `${SITE_URL}${modeloPath(marcaSlug, m.slug)}`,
      })),
    [marca, marcaSlug],
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm" role="status">
        Carregando...
      </div>
    );
  }

  if (!marca) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Marca não encontrada</p>
        <Link to="/" className="text-blue-600 text-sm font-semibold">
          ← Voltar à busca
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <ItemListJsonLd name={`Modelos ${marca.nome} — Tabela FIPE`} items={listItems} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: marca.nome, href: `${SITE_URL}${path}` },
        ]}
      />

      <SearchBox index={index} size="compact" showTabs={false} />

      <SeoBreadcrumb
        items={[{ label: 'Início', to: '/' }, { label: marca.nome }]}
      />

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Tabela FIPE — {marca.nome}
        </h1>
        <p className="text-sm text-slate-500">
          {marca.totalModelos.toLocaleString('pt-BR')} modelos ·{' '}
          {marca.totalVeiculos.toLocaleString('pt-BR')} veículos · {marca.tipo}
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-xs font-semibold" aria-label="Análises da marca">
        {MARCA_CLUSTER_TYPES.map((c) => (
          <Link
            key={c}
            to={clusterPath(marcaSlug, c)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 min-h-[44px] inline-flex items-center capitalize"
          >
            {c.replace(/-/g, ' ')}
          </Link>
        ))}
      </nav>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Modelos {marca.nome}</h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {marca.modelos.map((m) => (
            <li key={m.slug}>
              <Link
                to={modeloPath(marcaSlug, m.slug)}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 min-h-[44px]"
              >
                <span className="font-semibold text-sm">{m.nome}</span>
                <span className="text-xs text-slate-500 shrink-0">
                  {m.totalVeiculos} versões
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
        <Link to="/" className="text-blue-600 font-semibold">
          ← Nova pesquisa
        </Link>
        <Link to="/comparar" className="text-blue-600 font-semibold">
          Comparativos FIPE
        </Link>
      </nav>
    </div>
  );
}
