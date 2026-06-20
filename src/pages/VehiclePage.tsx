import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import PriceHero from '../components/vehicle/PriceHero';
import HistorySection from '../components/vehicle/HistorySection';
import AlternativesSection from '../components/vehicle/AlternativesSection';
import FaqSection from '../components/vehicle/FaqSection';
import VehicleJsonLd from '../components/vehicle/VehicleJsonLd';
import FaqJsonLd from '../components/vehicle/FaqJsonLd';
import BreadcrumbJsonLd from '../components/vehicle/BreadcrumbJsonLd';
import ShareButtons from '../components/vehicle/ShareButtons';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta, SITE_URL } from '../hooks/usePageMeta';
import { loadVehicle, computeTrend, vehicleDisplayName } from '../lib/vehicle';
import { generateFaq } from '../lib/faq';
import { findAlternatives } from '../lib/alternatives';
import { marcaSlug, vehiclePath, modeloSlug } from '../lib/slug';
import { marcaPath, modeloPath, historicoPath, compararPath, anoPath } from '../lib/seo-routes';
import { formatBRL } from '../lib/format';
import SemanticLinks from '../components/semantic/SemanticLinks';
import { Vehicle } from '../types';

export default function VehiclePage() {
  const { slug } = useParams<{ marca: string; slug: string }>();
  const { index } = useSearchIndex();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    loadVehicle(slug).then((v) => {
      setVehicle(v);
      setNotFound(!v);
      setLoading(false);
    });
  }, [slug]);

  const indexItem = useMemo(
    () => index.find((i) => i.id === slug) ?? null,
    [index, slug],
  );

  const alternatives = useMemo(() => {
    if (!indexItem) return [];
    return findAlternatives(indexItem, index);
  }, [indexItem, index]);

  const faq = useMemo(() => (vehicle ? generateFaq(vehicle) : []), [vehicle]);
  const trend6m = vehicle ? computeTrend(vehicle.historicoPrecos, 6) : null;

  const canonicalMarca = vehicle ? marcaSlug(vehicle.marca) : '';
  const displayName = vehicle ? vehicleDisplayName(vehicle) : '';
  const canonicalPath = vehicle ? `/fipe/${canonicalMarca}/${vehicle.id}` : '/';
  const pageTitle = vehicle
    ? `${displayName} ${vehicle.anoModelo} — Tabela FIPE | ${formatBRL(vehicle.valorAtual)}`
    : 'Veículo não encontrado';
  const pageDesc = vehicle
    ? `Preço FIPE do ${displayName} ${vehicle.anoModelo}: ${formatBRL(vehicle.valorAtual)}. Histórico, alternativas e FAQ. Atualizado Jun/2026.`
    : 'Veículo não encontrado na Tabela FIPE.';

  usePageMeta({
    title: pageTitle,
    description: pageDesc,
    path: canonicalPath,
    ogType: 'article',
  });

  const relatedYears = useMemo(() => {
    if (!vehicle || !indexItem) return [];
    const modeloKey = vehicle.modelo.toLowerCase().split(' ')[0];
    const seen = new Set<string>();
    return index
      .filter((i) => {
        if (i.id === vehicle.id) return false;
        if (!i.termoBusca.includes(modeloKey)) return false;
        const key = `${i.nome}-${i.ano}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0))
      .slice(0, 6);
  }, [vehicle, indexItem, index]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm" role="status">
        Carregando...
      </div>
    );
  }

  if (notFound || !vehicle) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Veículo não encontrado</p>
        <Link to="/" className="text-blue-600 text-sm font-semibold">
          ← Voltar à busca
        </Link>
      </div>
    );
  }

  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const mSlug = modeloSlug(vehicle.modelo);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <VehicleJsonLd vehicle={vehicle} url={canonicalUrl} />
      <FaqJsonLd items={faq} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', href: SITE_URL },
          { name: vehicle.marca, href: `${SITE_URL}${marcaPath(canonicalMarca)}` },
          { name: displayName, href: `${SITE_URL}${modeloPath(canonicalMarca, mSlug)}` },
          { name: String(vehicle.anoModelo), href: canonicalUrl },
        ]}
      />

      <SearchBox index={index} size="compact" showTabs={false} />

      <nav aria-label="Breadcrumb" className="text-xs text-slate-500 flex flex-wrap items-center gap-1">
        <Link to="/" className="hover:text-blue-600 min-h-[44px] inline-flex items-center">
          Início
        </Link>
        <span aria-hidden>›</span>
        <Link
          to={marcaPath(canonicalMarca)}
          className="capitalize hover:text-blue-600 min-h-[44px] inline-flex items-center"
        >
          {canonicalMarca}
        </Link>
        <span aria-hidden>›</span>
        <Link
          to={modeloPath(canonicalMarca, mSlug)}
          className="capitalize hover:text-blue-600 min-h-[44px] inline-flex items-center"
        >
          {vehicle.modelo.split(' ').slice(0, 2).join(' ')}
        </Link>
        <span aria-hidden>›</span>
        <span className="text-slate-700 dark:text-slate-300 font-medium min-h-[44px] inline-flex items-center">
          {vehicle.anoModelo === 0 ? 'Zero KM' : vehicle.anoModelo}
        </span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
          {displayName} {vehicle.anoModelo}
        </h1>
        <p className="text-sm text-slate-500">
          {vehicle.combustivel} · Cód. FIPE {vehicle.fipeCodigo} · Ref. Jun/2026
        </p>
        <ShareButtons title={pageTitle} url={canonicalUrl} />
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <PriceHero valor={vehicle.valorAtual} trend6m={trend6m} />
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 text-sm">
          <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">
            Dados do veículo
          </h2>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Marca</span>
            <span className="font-semibold">{vehicle.marca}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Modelo</span>
            <span className="font-semibold text-right">{vehicle.modelo}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Ano modelo</span>
            <span className="font-semibold">{vehicle.anoModelo}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Combustível</span>
            <span className="font-semibold">{vehicle.combustivel}</span>
          </div>
        </div>
      </div>

      <AlternativesSection alternatives={alternatives} modeloNome={displayName} />

      {relatedYears.length > 0 && (
        <section className="space-y-3" aria-label="Outros anos e versões">
          <h2 className="text-lg font-bold">Outros anos e versões</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {relatedYears.map((item) => (
              <Link
                key={item.id}
                to={vehiclePath(item.marca ?? 'geral', item.id)}
                className={`snap-start shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border min-h-[44px] flex items-center ${
                  item.id === vehicle.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                {item.ano} · {formatBRL(item.valor)}
              </Link>
            ))}
          </div>
        </section>
      )}

      <HistorySection vehicle={vehicle} />

      <nav
        className="flex flex-wrap gap-3 text-xs font-semibold text-blue-600"
        aria-label="Links relacionados"
      >
        <Link to={modeloPath(canonicalMarca, mSlug)} className="min-h-[44px] inline-flex items-center">
          Página do modelo →
        </Link>
        <Link to={historicoPath(canonicalMarca, mSlug)} className="min-h-[44px] inline-flex items-center">
          Histórico de preços →
        </Link>
        <Link to={anoPath(vehicle.anoModelo)} className="min-h-[44px] inline-flex items-center">
          Veículos {vehicle.anoModelo === 0 ? 'Zero KM' : vehicle.anoModelo} →
        </Link>
        <Link to="/comparar" className="min-h-[44px] inline-flex items-center">
          Comparativos →
        </Link>
      </nav>

      <SemanticLinks marcaSlug={canonicalMarca} modeloSlug={mSlug} ano={vehicle.anoModelo} />

      <FaqSection items={faq} />

      <nav className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800">
        <Link to="/" className="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">
          ← Nova pesquisa
        </Link>
      </nav>
    </div>
  );
}
