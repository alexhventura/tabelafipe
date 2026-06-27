import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import SeoBreadcrumb from '../components/seo/SeoBreadcrumb';
import ProductJsonLd from '../components/seo/ProductJsonLd';
import BreadcrumbJsonLd from '../components/vehicle/BreadcrumbJsonLd';
import PriceChart from '../components/vehicle/PriceChart';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta, SITE_URL } from '../hooks/usePageMeta';
import { loadModelo } from '../lib/seo-data';
import type { SeoModelo } from '../lib/seo-data';
import { peekEmbeddedModelo, hasPrerenderJsonLd } from '../lib/seoEmbed';
import { formatBRL } from '../lib/format';
import { vehiclePath } from '../lib/slug';
import { historicoPath, marcaPath } from '../lib/seo-routes';
import SemanticLinks from '../components/semantic/SemanticLinks';

export default function ModeloPage() {
  const { marcaSlug = '', modeloSlug = '' } = useParams();
  const { index } = useSearchIndex();
  const [modelo, setModelo] = useState<SeoModelo | null>(() =>
    peekEmbeddedModelo(marcaSlug, modeloSlug),
  );
  const [loading, setLoading] = useState(
    () => !peekEmbeddedModelo(marcaSlug, modeloSlug),
  );

  useEffect(() => {
    const embedded = peekEmbeddedModelo(marcaSlug, modeloSlug);
    if (embedded) {
      setModelo(embedded);
      setLoading(false);
      return;
    }

    setLoading(true);
    loadModelo(marcaSlug, modeloSlug).then((m) => {
      setModelo(m);
      setLoading(false);
    });
  }, [marcaSlug, modeloSlug]);

  const path = `/modelo/${marcaSlug}/${modeloSlug}`;
  const displayName = modelo ? `${modelo.marcaNome} ${modelo.modeloNome}` : '';

  usePageMeta({
    title: modelo
      ? `${displayName} — Tabela FIPE por ano | PesquisaTabelaFIPE`
      : 'Modelo não encontrado',
    description: modelo
      ? `${modelo.totalVeiculos} versões do ${displayName} na FIPE. Anos ${modelo.anos[0]}–${modelo.anos[modelo.anos.length - 1]}. Preço médio ${formatBRL(modelo.historico.valorMedio ?? 0)}.`
      : 'Modelo não encontrado.',
    path,
    ogType: 'article',
    noindex: !loading && !modelo,
  });

  const chartData = useMemo(
    () =>
      (modelo?.historico.pontos ?? []).map((p) => ({
        mes: p.referencia,
        valor: p.valorMedio,
      })),
    [modelo],
  );

  const skipJsonLd = hasPrerenderJsonLd() || Boolean(peekEmbeddedModelo(marcaSlug, modeloSlug));

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-600 dark:text-slate-400 text-sm" role="status">
        Carregando...
      </div>
    );
  }

  if (!modelo) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Modelo não encontrado</p>
        <Link to={marcaPath(marcaSlug)} className="text-blue-600 text-sm font-semibold">
          ← Ver marca
        </Link>
      </div>
    );
  }

  const canonicalUrl = `${SITE_URL}${path}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      {!skipJsonLd && (
        <ProductJsonLd
          name={displayName}
          brand={modelo.marcaNome}
          description={`Preços FIPE do ${displayName} — ${modelo.totalVeiculos} versões indexadas.`}
          url={canonicalUrl}
          lowPrice={modelo.historico.menorPreco}
          highPrice={modelo.historico.maiorPreco}
          offerCount={modelo.totalVeiculos}
        />
      )}
      {!skipJsonLd && (
        <BreadcrumbJsonLd
          items={[
            { name: 'Início', href: SITE_URL },
            { name: modelo.marcaNome, href: `${SITE_URL}${marcaPath(marcaSlug)}` },
            { name: modelo.modeloNome, href: canonicalUrl },
          ]}
        />
      )}

      <SearchBox index={index} size="compact" showTabs={false} />

      <SeoBreadcrumb
        items={[
          { label: 'Início', to: '/' },
          { label: modelo.marcaNome, to: marcaPath(marcaSlug) },
          { label: modelo.modeloNome },
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          {displayName} — Tabela FIPE
        </h1>
        <p className="text-sm text-slate-500">
          {modelo.totalVeiculos} versões · Anos {modelo.anos[0]}–{modelo.anos[modelo.anos.length - 1]}
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold">Resumo FIPE</h2>
          <div className="flex justify-between">
            <span className="text-slate-500">Menor preço</span>
            <span className="font-semibold">{formatBRL(modelo.historico.menorPreco ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Maior preço</span>
            <span className="font-semibold">{formatBRL(modelo.historico.maiorPreco ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Preço médio</span>
            <span className="font-semibold">{formatBRL(modelo.historico.valorMedio ?? 0)}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <Link
            to={historicoPath(marcaSlug, modeloSlug)}
            className="text-blue-600 font-semibold text-sm min-h-[44px] inline-flex items-center"
          >
            Ver histórico completo de preços →
          </Link>
        </div>
      </div>

      {chartData.length > 1 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Evolução média de preço</h2>
          <PriceChart data={chartData} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Versões e anos</h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {modelo.versoes
            .slice()
            .sort((a, b) => b.ano - a.ano)
            .map((v) => (
              <li key={v.id}>
                <Link
                  to={vehiclePath(modelo.marcaSlug, v.id)}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 min-h-[44px] text-sm"
                >
                  <span>
                    {v.ano === 0 ? 'Zero KM' : v.ano} · {v.combustivel}
                  </span>
                  <span className="font-semibold shrink-0">{formatBRL(v.valor)}</span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <SemanticLinks marcaSlug={marcaSlug} modeloSlug={modeloSlug} />

      <nav className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
        <Link to={marcaPath(marcaSlug)} className="text-blue-600 font-semibold">
          ← Todos os modelos {modelo.marcaNome}
        </Link>
        <Link to={historicoPath(marcaSlug, modeloSlug)} className="text-blue-600 font-semibold">
          Histórico de preços
        </Link>
      </nav>
    </div>
  );
}
