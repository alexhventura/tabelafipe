import { Link } from 'react-router-dom';
import { useEffect, useState, type ComponentType } from 'react';
import {
  Shield,
  History,
  FileText,
  Fuel,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import BrandLogo from '../components/brand/BrandLogo';
import SearchBox from '../components/search/SearchBox';
import FaqJsonLd from '../components/vehicle/FaqJsonLd';
import { HOME_FAQ } from '../content/homeFaq';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta } from '../hooks/usePageMeta';
import { VehicleTipo } from '../types';

type GuidedFipeSearchProps = {
  tipo: VehicleTipo;
  onTipoChange?: (tipo: VehicleTipo) => void;
  showTabs?: boolean;
};

function GuidedSearchPlaceholder() {
  return (
    <div
      className="w-full min-h-[320px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
      aria-hidden
    />
  );
}

function DeferredGuidedFipeSearch(props: GuidedFipeSearchProps) {
  const [Component, setComponent] = useState<ComponentType<GuidedFipeSearchProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      import('../components/search/GuidedFipeSearch').then((mod) => {
        if (!cancelled) setComponent(() => mod.default);
      });
    };

    if (typeof requestIdleCallback !== 'undefined') {
      const idleId = requestIdleCallback(load, { timeout: 1200 });
      return () => {
        cancelled = true;
        cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(load, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!Component) return <GuidedSearchPlaceholder />;
  return <Component {...props} />;
}

const WHY_CARDS = [
  { icon: TrendingUp, title: 'Preço FIPE atualizado', desc: 'Valor de referência oficial do mês' },
  { icon: History, title: 'Histórico completo', desc: 'Evolução de preços ao longo do tempo' },
  { icon: FileText, title: 'Ficha técnica', desc: 'Motor, câmbio, dimensões e versão' },
  { icon: Fuel, title: 'Consumo INMETRO', desc: 'Dados homologados quando disponíveis' },
  { icon: Shield, title: 'Segurança e recalls', desc: 'Latin NCAP e campanhas ativas' },
] as const;

const POPULAR = [
  { label: 'Corolla', q: 'Corolla' },
  { label: 'Onix', q: 'Onix' },
  { label: 'HB20', q: 'HB20' },
  { label: 'Strada', q: 'Strada' },
  { label: 'Gol', q: 'Gol' },
  { label: 'Compass', q: 'Compass' },
] as const;

const BRANDS = [
  { label: 'Toyota', slug: 'toyota' },
  { label: 'Volkswagen', slug: 'volkswagen' },
  { label: 'Chevrolet', slug: 'chevrolet' },
  { label: 'Fiat', slug: 'fiat' },
  { label: 'Honda', slug: 'honda' },
  { label: 'Hyundai', slug: 'hyundai' },
] as const;

const SEARCH_EXAMPLES = [
  'Corolla XEi 2024',
  'HB20 Comfort Plus 2022',
  'Strada Volcano 2023',
  '002112-1',
] as const;

export default function HomePage() {
  const { index, families, ensureShardsForQuery, ensureIndexReady } = useSearchIndex({ lazy: true });
  const [tipo, setTipo] = useState<VehicleTipo>('carros');

  usePageMeta({
    title: 'Tabela FIPE Completa — PesquisaTabelaFIPE',
    description:
      'Consulte preços FIPE, histórico, ficha técnica, consumo, manutenção, segurança e informações completas do seu veículo.',
    path: '/',
  });

  return (
    <div className="w-full overflow-x-hidden">
      <FaqJsonLd items={HOME_FAQ} />
      {/* HERO — único conteúdo acima da dobra */}
      <section
        className="min-h-[100dvh] flex flex-col justify-center max-w-2xl mx-auto px-4 py-10 sm:py-14"
        aria-label="Busca principal"
      >
        <div className="text-center space-y-6 w-full">
          <div className="flex justify-center">
            <BrandLogo size="lg" asLink={false} />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              Tabela FIPE Completa
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mx-auto">
              Consulte preços FIPE, histórico, ficha técnica, consumo, manutenção, segurança e informações
              completas do seu veículo.
            </p>
          </div>

          <div className="w-full text-left space-y-6" role="search">
            <DeferredGuidedFipeSearch tipo={tipo} onTipoChange={setTipo} showTabs />

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center">
                Busca rápida
              </p>
              <SearchBox
                index={index}
                families={families}
                onQueryChange={ensureShardsForQuery}
                onActivate={() => void ensureIndexReady()}
                tipo={tipo}
                onTipoChange={setTipo}
                size="hero"
                showTabs={false}
                hideLabel
                hideInlineExamples
                placeholder="Digite marca, modelo ou código FIPE"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
            {SEARCH_EXAMPLES.map((ex) => (
              <Link
                key={ex}
                to={`/busca?q=${encodeURIComponent(ex)}&tipo=${tipo}`}
                className="hover:text-blue-600 transition-colors min-h-[36px] inline-flex items-center px-1"
              >
                {ex}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Seções abaixo da dobra */}
      <div className="below-fold max-w-5xl mx-auto px-4 pb-16 space-y-16 sm:space-y-20">
        <section aria-labelledby="why-title" className="space-y-6">
          <h2 id="why-title" className="text-xl sm:text-2xl font-bold text-center text-slate-900 dark:text-white">
            Por que consultar aqui?
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {WHY_CARDS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 min-h-[120px]"
              >
                <Icon className="w-5 h-5 text-blue-600" strokeWidth={1.5} aria-hidden />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="popular-title" className="space-y-4">
          <h2 id="popular-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Veículos mais pesquisados
          </h2>
          <div className="flex flex-wrap gap-2">
            {POPULAR.map(({ label, q }) => (
              <Link
                key={label}
                to={`/busca?q=${encodeURIComponent(q)}&tipo=carros`}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:border-blue-500 transition-colors min-h-[44px] inline-flex items-center"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="brands-title" className="space-y-4">
          <h2 id="brands-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Marcas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BRANDS.map(({ label, slug }) => (
              <Link
                key={slug}
                to={`/marca/${slug}`}
                className="px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:border-blue-500 transition-colors min-h-[48px] flex items-center capitalize"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="faq-title" className="space-y-4 max-w-2xl">
          <h2 id="faq-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Perguntas frequentes
          </h2>
          <div className="space-y-2">
            {HOME_FAQ.map((item) => (
              <details
                key={item.pergunta}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <summary className="px-4 py-3 cursor-pointer font-semibold text-sm list-none flex justify-between items-center min-h-[48px]">
                  {item.pergunta}
                  <span className="text-slate-600 dark:text-slate-400 group-open:rotate-180 transition-transform shrink-0 ml-2" aria-hidden>
                    ▼
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.resposta}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
