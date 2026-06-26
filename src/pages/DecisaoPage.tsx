import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BreadcrumbJsonLd from '../components/vehicle/BreadcrumbJsonLd';
import FaqJsonLd from '../components/vehicle/FaqJsonLd';
import { usePageMeta, SITE_URL } from '../hooks/usePageMeta';
import { loadModelo } from '../lib/seo-data';
import { matchDecisaoSlug, type DecisaoMatch } from '../lib/semantic';
import {
  intentPath,
  modeloPath,
  decisaoOuPath,
} from '../lib/seo-routes';
import { formatBRL } from '../lib/format';

function slugFromPathname(pathname: string): string {
  return pathname.replace(/^\//, '').split('/')[0] ?? '';
}

export default function DecisaoPage() {
  const { pathname } = useLocation();
  const slug = slugFromPathname(pathname);
  const [match, setMatch] = useState<DecisaoMatch | null | undefined>(undefined);

  useEffect(() => {
    setMatch(undefined);
    if (!slug) {
      setMatch(null);
      return;
    }
    matchDecisaoSlug(slug).then(setMatch);
  }, [slug]);

  const path = slug ? `/${slug}` : '/';

  usePageMeta({
    title: match ? `Decisão de compra | PesquisaTabelaFIPE` : 'Página não encontrada',
    description: match
      ? 'Análise de compra com dados reais da Tabela FIPE.'
      : 'Página não encontrada.',
    path,
    ogType: 'article',
    noindex: match === null,
  });

  if (match === undefined) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm" role="status">
        Carregando...
      </div>
    );
  }

  if (!match) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Página não encontrada</p>
        <Link to="/" className="text-blue-600 text-sm font-semibold">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <DecisaoContent match={match} path={path} />
  );
}

function DecisaoContent({ match, path }: { match: DecisaoMatch; path: string }) {
  const canonicalUrl = `${SITE_URL}${path}`;

  if (match.kind === 'vale-a-pena') {
    return (
      <ValeAPenaView entry={match.entry} canonicalUrl={canonicalUrl} />
    );
  }
  if (match.kind === 'comparativo-ou') {
    return (
      <ComparativoOuView entry={match.entry} canonicalUrl={canonicalUrl} />
    );
  }
  return <MelhoresView entry={match.entry} canonicalUrl={canonicalUrl} />;
}

function ValeAPenaView({
  entry,
  canonicalUrl,
}: {
  entry: Extract<DecisaoMatch, { kind: 'vale-a-pena' }>['entry'];
  canonicalUrl: string;
}) {
  const [modelo, setModelo] = useState<Awaited<ReturnType<typeof loadModelo>>>(null);

  useEffect(() => {
    loadModelo(entry.marcaSlug, entry.modeloSlug).then(setModelo);
  }, [entry.marcaSlug, entry.modeloSlug]);

  const anoLabel = entry.ano === 0 ? 'Zero KM' : String(entry.ano);
  const title = `Vale a pena comprar ${entry.marcaSlug} ${entry.modeloSlug} ${anoLabel}?`;
  const versoes = modelo?.versoes.filter((v) => v.ano === entry.ano) ?? [];
  const media =
    versoes.length > 0
      ? Math.round(versoes.reduce((s, v) => s + v.valor, 0) / versoes.length)
      : null;

  const faq = [
    {
      pergunta: title,
      resposta:
        media != null
          ? `Preço médio FIPE ${anoLabel}: ${formatBRL(media)}. Compare histórico e rivais antes de fechar negócio.`
          : 'Consulte preços FIPE por versão e histórico do modelo.',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <FaqJsonLd items={faq} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: 'Decisão de compra', href: canonicalUrl },
        ]}
      />
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold capitalize">{title}</h1>
        <p className="text-sm text-slate-500">Score de prioridade SEO: {entry.totalScore}</p>
      </header>
      {modelo && (
        <>
          {media != null && (
            <p className="text-sm font-semibold">Referência FIPE média: {formatBRL(media)}</p>
          )}
          {typeof modelo.historico.desvalorizacaoPercentual === 'number' && (
            <p className="text-sm text-slate-600">
              Desvalorização histórica agregada: {modelo.historico.desvalorizacaoPercentual}%
            </p>
          )}
          <nav className="flex flex-wrap gap-3 text-sm font-semibold text-blue-600">
            <Link to={modeloPath(entry.marcaSlug, entry.modeloSlug)}>Página do modelo</Link>
            <Link to={intentPath(entry.marcaSlug, entry.modeloSlug, entry.ano, 'preco')}>
              Preço FIPE {anoLabel}
            </Link>
            <Link to={intentPath(entry.marcaSlug, entry.modeloSlug, entry.ano, 'vale-a-pena')}>
              Intent vale a pena
            </Link>
          </nav>
        </>
      )}
    </div>
  );
}

function ComparativoOuView({
  entry,
  canonicalUrl,
}: {
  entry: Extract<DecisaoMatch, { kind: 'comparativo-ou' }>['entry'];
  canonicalUrl: string;
}) {
  const title = `${entry.a.modeloNome.split(' ')[0]} ou ${entry.b.modeloNome.split(' ')[0]}?`;
  const faq = [
    {
      pergunta: `Qual vale mais: ${entry.a.modeloNome} ou ${entry.b.modeloNome}?`,
      resposta: `FIPE média aproximada: ${formatBRL(entry.a.valorMedio)} vs ${formatBRL(entry.b.valorMedio)} (dados agregados do modelo).`,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <FaqJsonLd items={faq} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: title, href: canonicalUrl },
        ]}
      />
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        <p className="text-sm text-slate-500">Segmento: {entry.segmento}</p>
      </header>
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div className="border rounded-2xl p-4 space-y-2">
          <h2 className="font-bold">{entry.a.modeloNome}</h2>
          <p>Valor médio FIPE: {formatBRL(entry.a.valorMedio)}</p>
          <p>{entry.a.totalVeiculos} versões indexadas</p>
          <Link className="text-blue-600 font-semibold" to={modeloPath(entry.a.marcaSlug, entry.a.modeloSlug)}>
            Ver modelo
          </Link>
        </div>
        <div className="border rounded-2xl p-4 space-y-2">
          <h2 className="font-bold">{entry.b.modeloNome}</h2>
          <p>Valor médio FIPE: {formatBRL(entry.b.valorMedio)}</p>
          <p>{entry.b.totalVeiculos} versões indexadas</p>
          <Link className="text-blue-600 font-semibold" to={modeloPath(entry.b.marcaSlug, entry.b.modeloSlug)}>
            Ver modelo
          </Link>
        </div>
      </div>
      <Link
        to={decisaoOuPath(entry.a.modeloSlug, entry.b.modeloSlug)}
        className="text-xs text-slate-500"
      >
        URL canônica: {entry.slug}
      </Link>
    </div>
  );
}

function MelhoresView({
  entry,
  canonicalUrl,
}: {
  entry: Extract<DecisaoMatch, { kind: 'melhores' }>['entry'];
  canonicalUrl: string;
}) {
  const title = `Melhores ${entry.segmento.replace(/-/g, ' ')} ${entry.ano}`;
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: title, href: canonicalUrl },
        ]}
      />
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold capitalize">{title}</h1>
        <p className="text-sm text-slate-500">Ranking por score FIPE e cobertura de dados.</p>
      </header>
      <ol className="space-y-3">
        {entry.modelos.map((m, idx) => (
          <li
            key={`${m.marcaSlug}-${m.modeloSlug}`}
            className="flex flex-wrap items-center justify-between gap-2 border rounded-xl px-4 py-3 text-sm"
          >
            <span className="font-semibold">
              {idx + 1}. {m.modeloNome}
            </span>
            <span>{formatBRL(m.valorMedioAno)}</span>
            <Link
              to={modeloPath(m.marcaSlug, m.modeloSlug)}
              className="text-blue-600 font-semibold w-full sm:w-auto"
            >
              Ver modelo
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DecisaoRouter() {
  return <DecisaoPage />;
}
