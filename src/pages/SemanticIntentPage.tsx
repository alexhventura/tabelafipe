import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SeoBreadcrumb from '../components/seo/SeoBreadcrumb';
import ProductJsonLd from '../components/seo/ProductJsonLd';
import BreadcrumbJsonLd from '../components/vehicle/BreadcrumbJsonLd';
import FaqJsonLd from '../components/vehicle/FaqJsonLd';
import SemanticLinks from '../components/semantic/SemanticLinks';
import { usePageMeta, SITE_URL } from '../hooks/usePageMeta';
import { loadModelo } from '../lib/seo-data';
import {
  buildIntentContent,
  isReservedMarcaSlug,
  parseSemanticSlug,
} from '../lib/semantic';
import { marcaPath } from '../lib/seo-routes';
import { formatBRL } from '../lib/format';

export default function SemanticIntentPage() {
  const { marcaSlug = '', pageSlug = '' } = useParams();
  const parsed = useMemo(() => parseSemanticSlug(pageSlug), [pageSlug]);
  const [modelo, setModelo] = useState<Awaited<ReturnType<typeof loadModelo>>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parsed || isReservedMarcaSlug(marcaSlug)) {
      setModelo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadModelo(marcaSlug, parsed.modeloSlug).then((m) => {
      setModelo(m);
      setLoading(false);
    });
  }, [marcaSlug, parsed]);

  const content = useMemo(() => {
    if (!modelo || !parsed) return null;
    return buildIntentContent(modelo, parsed.ano, parsed.intent);
  }, [modelo, parsed]);

  const path = parsed ? `/${marcaSlug}/${pageSlug}` : '/';

  usePageMeta({
    title: content?.title ?? 'Página não encontrada',
    description: content?.description ?? 'Conteúdo não encontrado.',
    path,
    ogType: 'article',
    noindex: !loading && !content,
  });

  if (isReservedMarcaSlug(marcaSlug) || !parsed) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Página não encontrada</p>
        <Link to="/" className="text-blue-600 text-sm font-semibold">
          Voltar ao início
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-600 dark:text-slate-400 text-sm" role="status">
        Carregando...
      </div>
    );
  }

  if (!modelo || !content) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Modelo não encontrado</p>
        <Link to={marcaPath(marcaSlug)} className="text-blue-600 text-sm font-semibold">
          Ver marca
        </Link>
      </div>
    );
  }

  const canonicalUrl = `${SITE_URL}${path}`;
  const displayName = `${modelo.marcaNome} ${modelo.modeloNome}`;
  const versoesAno = modelo.versoes.filter((v) => v.ano === parsed.ano);
  const media =
    versoesAno.length > 0
      ? Math.round(versoesAno.reduce((s, v) => s + v.valor, 0) / versoesAno.length)
      : modelo.historico.valorMedio;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <ProductJsonLd
        name={`${displayName} ${parsed.ano === 0 ? 'Zero KM' : parsed.ano}`}
        brand={modelo.marcaNome}
        description={content.description}
        url={canonicalUrl}
        lowPrice={modelo.historico.menorPreco ?? undefined}
        highPrice={modelo.historico.maiorPreco ?? undefined}
        offerCount={versoesAno.length || modelo.totalVeiculos}
      />
      {content.faq.length > 0 && <FaqJsonLd items={content.faq} />}
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: modelo.marcaNome, href: `${SITE_URL}${marcaPath(marcaSlug)}` },
          { name: modelo.modeloNome, href: `${SITE_URL}/modelo/${marcaSlug}/${parsed.modeloSlug}` },
          { name: content.title, href: canonicalUrl },
        ]}
      />

      <SeoBreadcrumb
        items={[
          { label: 'Início', to: '/' },
          { label: modelo.marcaNome, to: marcaPath(marcaSlug) },
          { label: modelo.modeloNome, to: `/modelo/${marcaSlug}/${parsed.modeloSlug}` },
          { label: parsed.intent.replace(/-/g, ' ') },
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{content.title.replace(' | PesquisaTabelaFIPE', '')}</h1>
        <p className="text-sm text-slate-500">{content.description}</p>
        {media != null && (
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Referência FIPE: {formatBRL(media)}
          </p>
        )}
      </header>

      {content.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-lg font-bold">{section.heading}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{section.body}</p>
        </section>
      ))}

      {content.links.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Links úteis</h2>
          <ul className="text-sm space-y-2">
            {content.links.map((link) => (
              <li key={link.href}>
                <Link to={link.href} className="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">
                  {link.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SemanticLinks
        marcaSlug={marcaSlug}
        modeloSlug={parsed.modeloSlug}
        ano={parsed.ano}
        currentIntent={parsed.intent}
      />
    </div>
  );
}
