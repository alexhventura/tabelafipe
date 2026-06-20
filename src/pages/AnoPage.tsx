import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import SeoBreadcrumb from '../components/seo/SeoBreadcrumb';
import ItemListJsonLd from '../components/seo/ItemListJsonLd';
import BreadcrumbJsonLd from '../components/vehicle/BreadcrumbJsonLd';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta, SITE_URL } from '../hooks/usePageMeta';
import { loadAno } from '../lib/seo-data';
import type { SeoAnoEntry } from '../lib/seo-data';
import { formatBRL } from '../lib/format';
import { vehiclePath } from '../lib/slug';
import { anoPath } from '../lib/seo-routes';

export default function AnoPage() {
  const { year = '' } = useParams();
  const anoNum = parseInt(year, 10);
  const { index } = useSearchIndex();
  const [entry, setEntry] = useState<SeoAnoEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Number.isNaN(anoNum)) {
      setEntry(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadAno(anoNum).then((e) => {
      setEntry(e);
      setLoading(false);
    });
  }, [anoNum]);

  const path = anoPath(year);
  const label = anoNum === 0 ? 'Zero KM' : String(anoNum);

  usePageMeta({
    title: entry
      ? `Tabela FIPE ${label} — ${entry.totalVeiculos.toLocaleString('pt-BR')} veículos`
      : 'Ano não encontrado',
    description: entry
      ? `${entry.totalVeiculos.toLocaleString('pt-BR')} veículos ${label} na FIPE. ${entry.marcas} marcas, ${entry.modelos} modelos.`
      : 'Ano não encontrado.',
    path,
  });

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm" role="status">
        Carregando...
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Ano não encontrado</p>
        <Link to="/" className="text-blue-600 text-sm font-semibold">
          ← Voltar à busca
        </Link>
      </div>
    );
  }

  const listItems = entry.topVeiculos.map((v) => ({
    name: v.nome,
    url: `${SITE_URL}${vehiclePath(v.marcaSlug, v.id)}`,
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <ItemListJsonLd name={`Veículos FIPE ${label}`} items={listItems} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: `Ano ${label}`, href: `${SITE_URL}${path}` },
        ]}
      />

      <SearchBox index={index} size="compact" showTabs={false} />

      <SeoBreadcrumb
        items={[{ label: 'Início', to: '/' }, { label: `Ano ${label}` }]}
      />

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Tabela FIPE — {label}
        </h1>
        <p className="text-sm text-slate-500">
          {entry.totalVeiculos.toLocaleString('pt-BR')} veículos · {entry.marcas} marcas ·{' '}
          {entry.modelos} modelos
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Veículos {label}</h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {entry.topVeiculos.map((v) => (
            <li key={v.id}>
              <Link
                to={vehiclePath(v.marcaSlug, v.id)}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 min-h-[44px] text-sm"
              >
                <span className="font-medium">{v.nome}</span>
                <span className="font-semibold shrink-0">{formatBRL(v.valor)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800">
        <Link to="/" className="text-blue-600 font-semibold">
          ← Nova pesquisa
        </Link>
      </nav>
    </div>
  );
}
