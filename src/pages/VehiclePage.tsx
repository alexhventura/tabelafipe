import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import VehiclePageSections from '../components/vehicle/VehiclePageSections';
import ShareButtons from '../components/vehicle/ShareButtons';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { useBundleSeo } from '../hooks/useBundleSeo';
import { loadVehicleBundle, loadFamilyHub } from '../lib/bundle';
import HubPage from './HubPage';
import type { VehiclePageBundle } from '../types/bundle';

export default function VehiclePage() {
  const { marca, slug } = useParams<{ marca: string; slug: string }>();
  const { index } = useSearchIndex();
  const [bundle, setBundle] = useState<VehiclePageBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isFamilyHub, setIsFamilyHub] = useState(false);

  useEffect(() => {
    if (!marca || !slug) return;
    setLoading(true);
    setIsFamilyHub(false);
    loadVehicleBundle(marca, slug).then(async (b) => {
      if (b) {
        setBundle(b);
        setNotFound(false);
        setLoading(false);
        return;
      }
      const hub = await loadFamilyHub(marca, slug);
      if (hub) {
        setIsFamilyHub(true);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [marca, slug]);

  useBundleSeo(bundle?.seo ?? null);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm" role="status">
        Carregando...
      </div>
    );
  }

  if (isFamilyHub && marca && slug) {
    return <HubPage hubKind="familia" />;
  }

  if (notFound || !bundle) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Veículo não encontrado</p>
        <Link to="/" className="text-blue-600 text-sm font-semibold">
          ← Voltar à busca
        </Link>
      </div>
    );
  }

  const { identity, fipe, seo } = bundle;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <SearchBox index={index} size="compact" showTabs={false} />

      <nav aria-label="Breadcrumb" className="text-xs text-slate-500 flex flex-wrap items-center gap-1">
        {seo.breadcrumb.map((crumb, i) => (
          <span key={crumb.path} className="inline-flex items-center gap-1">
            {i > 0 && <span aria-hidden>›</span>}
            {i < seo.breadcrumb.length - 1 ? (
              <Link to={crumb.path} className="hover:text-blue-600 min-h-[44px] inline-flex items-center capitalize">
                {crumb.name}
              </Link>
            ) : (
              <span className="text-slate-700 dark:text-slate-300 font-medium min-h-[44px] inline-flex items-center">
                {crumb.name}
              </span>
            )}
          </span>
        ))}
      </nav>

      <header className="space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
          {seo.h1}
        </h1>
        <p className="text-sm text-slate-500">
          {identity.combustivel} · Cód. FIPE {fipe.fipeCodigo} · Ref. {fipe.mesReferencia}
        </p>
        <ShareButtons title={seo.title} url={seo.canonical} />
      </header>

      <VehiclePageSections bundle={bundle} />

      <nav className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800">
        <Link to="/" className="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">
          ← Nova pesquisa
        </Link>
      </nav>
    </div>
  );
}
