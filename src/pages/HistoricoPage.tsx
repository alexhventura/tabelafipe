import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import SeoBreadcrumb from '../components/seo/SeoBreadcrumb';
import BreadcrumbJsonLd from '../components/vehicle/BreadcrumbJsonLd';
import FaqJsonLd from '../components/vehicle/FaqJsonLd';
import PriceChart from '../components/vehicle/PriceChart';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta, SITE_URL } from '../hooks/usePageMeta';
import { loadModelo } from '../lib/seo-data';
import type { SeoModelo } from '../lib/seo-data';
import { formatBRL } from '../lib/format';
import { historicoPath, marcaPath, modeloPath } from '../lib/seo-routes';

export default function HistoricoPage() {
  const { marcaSlug = '', modeloSlug = '' } = useParams();
  const { index } = useSearchIndex();
  const [modelo, setModelo] = useState<SeoModelo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadModelo(marcaSlug, modeloSlug).then((m) => {
      setModelo(m);
      setLoading(false);
    });
  }, [marcaSlug, modeloSlug]);

  const path = `/historico/${marcaSlug}/${modeloSlug}`;
  const displayName = modelo ? `${modelo.marcaNome} ${modelo.modeloNome}` : '';

  const faq = useMemo(() => {
    if (!modelo) return [];
    const h = modelo.historico;
    return [
      {
        pergunta: `Qual o menor preço FIPE já registrado do ${displayName}?`,
        resposta: h.menorPreco
          ? `O menor valor histórico foi ${formatBRL(h.menorPreco)}.`
          : 'Não há histórico suficiente.',
      },
      {
        pergunta: `Qual o maior preço FIPE do ${displayName}?`,
        resposta: h.maiorPreco
          ? `O maior valor histórico foi ${formatBRL(h.maiorPreco)}.`
          : 'Não há histórico suficiente.',
      },
      {
        pergunta: `O ${displayName} valorizou ou desvalorizou?`,
        resposta:
          h.valorizacaoPercentual != null
            ? `Valorização de ${h.valorizacaoPercentual}% no período analisado.`
            : h.desvalorizacaoPercentual != null
              ? `Desvalorização de ${h.desvalorizacaoPercentual}% no período analisado.`
              : 'Variação estável ou dados insuficientes.',
      },
    ];
  }, [modelo, displayName]);

  usePageMeta({
    title: modelo
      ? `Histórico FIPE ${displayName} — evolução de preços`
      : 'Histórico não encontrado',
    description: modelo
      ? `Evolução de preços FIPE do ${displayName}. Menor: ${formatBRL(modelo.historico.menorPreco ?? 0)}, maior: ${formatBRL(modelo.historico.maiorPreco ?? 0)}.`
      : 'Histórico não encontrado.',
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
        <p className="text-lg font-semibold">Histórico não encontrado</p>
        <Link to={modeloPath(marcaSlug, modeloSlug)} className="text-blue-600 text-sm font-semibold">
          ← Ver modelo
        </Link>
      </div>
    );
  }

  const h = modelo.historico;
  const canonicalUrl = `${SITE_URL}${path}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <FaqJsonLd items={faq} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: modelo.marcaNome, href: `${SITE_URL}${marcaPath(marcaSlug)}` },
          { name: modelo.modeloNome, href: `${SITE_URL}${modeloPath(marcaSlug, modeloSlug)}` },
          { name: 'Histórico', href: canonicalUrl },
        ]}
      />

      <SearchBox index={index} size="compact" showTabs={false} />

      <SeoBreadcrumb
        items={[
          { label: 'Início', to: '/' },
          { label: modelo.marcaNome, to: marcaPath(marcaSlug) },
          { label: modelo.modeloNome, to: modeloPath(marcaSlug, modeloSlug) },
          { label: 'Histórico' },
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Histórico FIPE — {displayName}
        </h1>
        <p className="text-sm text-slate-500">
          {h.pontos.length} referências · média {formatBRL(h.valorMedio ?? 0)}
        </p>
      </header>

      {chartData.length > 1 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Evolução de preço</h2>
          <PriceChart data={chartData} />
        </section>
      )}

      <section className="grid sm:grid-cols-2 gap-4 text-sm">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold">Métricas</h2>
          <div className="flex justify-between">
            <span className="text-slate-500">Menor valor</span>
            <span className="font-semibold text-emerald-600">{formatBRL(h.menorPreco ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Maior valor</span>
            <span className="font-semibold">{formatBRL(h.maiorPreco ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Média histórica</span>
            <span className="font-semibold">{formatBRL(h.valorMedio ?? 0)}</span>
          </div>
          {h.valorizacaoPercentual != null && (
            <div className="flex justify-between">
              <span className="text-slate-500">Valorização</span>
              <span className="font-semibold text-emerald-600">+{h.valorizacaoPercentual}%</span>
            </div>
          )}
          {h.desvalorizacaoPercentual != null && (
            <div className="flex justify-between">
              <span className="text-slate-500">Desvalorização</span>
              <span className="font-semibold text-rose-600">-{h.desvalorizacaoPercentual}%</span>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Perguntas frequentes</h2>
        <dl className="space-y-4 text-sm">
          {faq.map((item) => (
            <div key={item.pergunta}>
              <dt className="font-semibold text-slate-900 dark:text-white">{item.pergunta}</dt>
              <dd className="text-slate-600 dark:text-slate-400 mt-1">{item.resposta}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
        <Link to={modeloPath(marcaSlug, modeloSlug)} className="text-blue-600 font-semibold">
          ← Página do modelo
        </Link>
      </nav>
    </div>
  );
}
