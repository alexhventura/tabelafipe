import { useEffect, useMemo, useState } from 'react';

import { Link, useParams } from 'react-router-dom';

import VehicleBreadcrumb from '../components/vehicle/VehicleBreadcrumb';
import VehiclePageSections, { buildEnhancedFaq, buildFaqJsonLd } from '../components/vehicle/VehiclePageSections';
import { useBundleSeo } from '../hooks/useBundleSeo';
import { loadVehicleBundle, loadFamilyHub, peekEmbeddedVehicleBundle } from '../lib/bundle';
import { buildVehicleBreadcrumb } from '../lib/vehiclePageData';
import {
  clearVehiclePrerenderMinHeight,
  getCapturedVehiclePrerenderHtml,
  hadVehiclePrerenderShell,
} from '../lib/vehiclePrerender';
import HubPage from './HubPage';

import type { VehiclePageBundle } from '../types/bundle';

export default function VehiclePage() {

  const { marca, slug } = useParams<{ marca: string; slug: string }>();

  const [bundle, setBundle] = useState<VehiclePageBundle | null>(() => peekEmbeddedVehicleBundle());

  const [loading, setLoading] = useState(() => !peekEmbeddedVehicleBundle());

  const [notFound, setNotFound] = useState(false);

  const [isFamilyHub, setIsFamilyHub] = useState(false);



  useEffect(() => {

    if (!marca || !slug) return;

    const embedded = peekEmbeddedVehicleBundle();
    if (embedded) {
      setBundle(embedded);
      setNotFound(false);
      setIsFamilyHub(false);
      setLoading(false);
      return;
    }

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

  useEffect(() => {
    if (!loading) {
      clearVehiclePrerenderMinHeight();
    }
  }, [loading]);

  const enhancedFaq = useMemo(() => (bundle ? buildEnhancedFaq(bundle) : []), [bundle]);
  const breadcrumbItems = useMemo(() => (bundle ? buildVehicleBreadcrumb(bundle) : []), [bundle]);

  const extraJsonLd = useMemo(() => {

    const faqLd = buildFaqJsonLd(enhancedFaq);

    return faqLd ? [faqLd] : [];

  }, [enhancedFaq]);



  useBundleSeo(bundle?.seo ?? null, extraJsonLd);



  if (loading) {
    const captured = getCapturedVehiclePrerenderHtml();
    if (captured && hadVehiclePrerenderShell()) {
      return (
        <div
          data-prerender="vehicle"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: captured }}
        />
      );
    }

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



  const keepPrerenderShell = Boolean(bundle) && hadVehiclePrerenderShell();

  return (
    <div
      className="max-w-3xl mx-auto px-4 py-3 sm:py-4 space-y-3"
      {...(keepPrerenderShell
        ? { 'data-prerender': 'vehicle', suppressHydrationWarning: true as const }
        : {})}
    >
      <VehicleBreadcrumb items={breadcrumbItems} />

      <VehiclePageSections bundle={bundle} />



      <nav className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800">

        <Link to="/" className="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">

          ← Nova pesquisa

        </Link>

      </nav>

    </div>

  );

}


