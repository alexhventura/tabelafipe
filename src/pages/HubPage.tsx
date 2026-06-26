import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import VehicleBreadcrumb from '../components/vehicle/VehicleBreadcrumb';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta } from '../hooks/usePageMeta';
import { formatBRL } from '../lib/format';
import { formatRelatedYear } from '../lib/displayYear';
import type { RelatedLink } from '../types/bundle';

type HubBundle = {
  tipo: 'familia' | 'geracao' | 'motor' | 'plataforma';
  slug: string;
  canonicalPath: string;
  titulo: string;
  descricao: string;
  seo: { title: string; description: string; h1: string; canonical: string };
  veiculos: RelatedLink[];
  stats?: { total: number; precoMin?: number; precoMax?: number; anos?: number[] };
  meta?: Record<string, unknown>;
};

async function loadHub(path: string): Promise<HubBundle | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as HubBundle;
  } catch {
    return null;
  }
}

function formatFamilyLabel(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeValorMedio(veiculos: RelatedLink[]): number | null {
  const valores = veiculos.map((v) => v.valorAtual).filter((v) => v > 0);
  if (!valores.length) return null;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

function pickPopularVersions(veiculos: RelatedLink[]): RelatedLink[] {
  if (!veiculos.length) return [];
  const maxYear = Math.max(...veiculos.map((v) => v.ano));
  const recent = veiculos.filter((v) => v.ano >= maxYear - 1);
  const seen = new Set<string>();
  const out: RelatedLink[] = [];
  for (const v of [...recent].sort((a, b) => b.valorAtual - a.valorAtual)) {
    const key = v.displayName.toLowerCase().replace(/\s+/g, ' ').slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= 6) break;
  }
  return out;
}

function decadeLabel(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

async function loadGeracaoHubs(marcaSlug: string, famSlug: string): Promise<HubBundle[]> {
  const candidates = [12, 11, 10, 9, 8, 7, 6].map((n) => `${famSlug}-${n}`);
  const results = await Promise.all(
    candidates.map((slug) => loadHub(`/data/hubs/geracao/${marcaSlug}/${slug}.json`)),
  );
  return results.filter((h): h is HubBundle => h != null);
}

export default function HubPage({ hubKind }: { hubKind: HubBundle['tipo'] }) {
  const params = useParams();
  const { index, families } = useSearchIndex();
  const [hub, setHub] = useState<HubBundle | null>(null);
  const [geracoes, setGeracoes] = useState<HubBundle[]>([]);
  const [loading, setLoading] = useState(true);

  const marcaSlug = params.marca ?? '';
  const famSlug = params.modeloFamilia ?? params.slug ?? '';

  useEffect(() => {
    let path = '';
    if (hubKind === 'familia' && params.marca) {
      if (famSlug) path = `/data/hubs/familia/${params.marca}/${famSlug}.json`;
    } else if (hubKind === 'geracao' && params.marca && params.geracaoSlug) {
      path = `/data/hubs/geracao/${params.marca}/${params.geracaoSlug}.json`;
    } else if (hubKind === 'motor' && params.engineSlug) {
      path = `/data/hubs/motor/${params.engineSlug}.json`;
    } else if (hubKind === 'plataforma' && params.platformSlug) {
      path = `/data/hubs/plataforma/${params.platformSlug}.json`;
    }
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadHub(path).then((h) => {
      setHub(h);
      setLoading(false);
    });
  }, [hubKind, params, famSlug]);

  useEffect(() => {
    if (hubKind !== 'familia' || !marcaSlug || !famSlug) {
      setGeracoes([]);
      return;
    }
    loadGeracaoHubs(marcaSlug, famSlug).then(setGeracoes);
  }, [hubKind, marcaSlug, famSlug]);

  const sortedVeiculos = useMemo(
    () => [...(hub?.veiculos ?? [])].sort((a, b) => b.ano - a.ano || a.displayName.localeCompare(b.displayName)),
    [hub?.veiculos],
  );

  const valorMedio = useMemo(() => computeValorMedio(sortedVeiculos), [sortedVeiculos]);
  const popularVersions = useMemo(() => pickPopularVersions(sortedVeiculos), [sortedVeiculos]);

  const timelineDecades = useMemo(() => {
    const anos: number[] = hub?.stats?.anos ?? sortedVeiculos.map((v) => v.ano);
    const decades = new Set(anos.map(decadeLabel));
    return [...decades].sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  }, [hub?.stats?.anos, sortedVeiculos]);

  const marcaDisplay = sortedVeiculos[0]?.marca ?? formatFamilyLabel(marcaSlug);
  const famDisplay = formatFamilyLabel(famSlug);

  const breadcrumbItems = useMemo(() => {
    if (hubKind !== 'familia' || !marcaSlug || !famSlug) return [];
    return [
      { name: 'Home', path: '/' },
      { name: marcaDisplay, path: `/fipe/${marcaSlug}/` },
      { name: famDisplay },
    ];
  }, [hubKind, marcaSlug, famSlug, marcaDisplay, famDisplay]);

  usePageMeta({
    title: hub?.seo.title ?? 'Hub FIPE',
    description: hub?.seo.description ?? '',
    path: hub?.canonicalPath ?? '/',
    noindex: !loading && !hub,
  });

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm">Carregando...</div>;
  }
  if (!hub) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-semibold">Página não encontrada</p>
        <Link to="/" className="text-blue-600 text-sm font-semibold">
          ← Voltar à busca
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <SearchBox index={index} families={families} size="compact" showTabs={false} />

      {breadcrumbItems.length > 0 && <VehicleBreadcrumb items={breadcrumbItems} />}

      <header className="space-y-4">
        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
          {hubKind === 'familia' ? 'Família' : hubKind}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold capitalize">
          {hubKind === 'familia' ? `${marcaDisplay} ${famDisplay}` : hub.seo.h1}
        </h1>
        <p className="text-sm text-slate-500">{hub.descricao}</p>

        {hubKind === 'familia' && hub.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Versões</p>
              <p className="text-lg font-bold">{hub.stats.total}</p>
            </div>
            {valorMedio != null && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Valor médio</p>
                <p className="text-lg font-bold tabular-nums">{formatBRL(valorMedio)}</p>
              </div>
            )}
            {hub.stats.precoMin != null && hub.stats.precoMax != null && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900 col-span-2 sm:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Faixa de preço</p>
                <p className="text-lg font-bold tabular-nums">
                  {formatBRL(hub.stats.precoMin)} – {formatBRL(hub.stats.precoMax)}
                </p>
              </div>
            )}
          </div>
        )}

        {hubKind === 'familia' && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Escolha a versão e o ano para ver preço FIPE, histórico e ficha técnica completa.
          </p>
        )}
      </header>

      {hubKind === 'familia' && geracoes.length > 0 && (
        <section className="space-y-3" aria-labelledby="hub-geracoes-title">
          <h2 id="hub-geracoes-title" className="text-lg font-bold">
            Linha do tempo das gerações
          </h2>
          <div className="flex flex-wrap gap-2">
            {geracoes.map((g) => (
              <Link
                key={g.slug}
                to={g.canonicalPath}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:border-blue-500 bg-white dark:bg-slate-900 min-h-[44px] inline-flex items-center"
              >
                {g.titulo.replace(/^Geracao\s/i, 'Geração ')}
                <span className="text-slate-400 font-normal ml-1">({g.veiculos.length})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hubKind === 'familia' && timelineDecades.length > 0 && (
        <section className="space-y-2" aria-labelledby="hub-timeline-title">
          <h2 id="hub-timeline-title" className="text-sm font-semibold text-slate-500">
            Anos disponíveis
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {timelineDecades.map((d) => (
              <span
                key={d}
                className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                {d}
              </span>
            ))}
          </div>
        </section>
      )}

      {hubKind === 'familia' && popularVersions.length > 0 && (
        <section className="space-y-3" aria-labelledby="hub-populares-title">
          <h2 id="hub-populares-title" className="text-lg font-bold">
            Versões mais procuradas
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {popularVersions.map((v) => (
              <Link
                key={v.vehicleId}
                to={v.canonicalPath}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors min-h-[56px] bg-white dark:bg-slate-900"
              >
                <p className="text-sm font-semibold line-clamp-2">{v.displayName}</p>
                <p className="text-xs text-slate-500 mt-1">{formatRelatedYear(v)}</p>
                <p className="text-sm font-bold text-blue-600 mt-1 tabular-nums">{formatBRL(v.valorAtual)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="hub-versoes-title">
        <h2 id="hub-versoes-title" className="text-lg font-bold">
          {hubKind === 'familia' ? 'Escolha sua versão' : 'Versões e anos'}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {sortedVeiculos.map((v) => (
            <Link
              key={v.vehicleId}
              to={v.canonicalPath}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors min-h-[56px] bg-white dark:bg-slate-900"
            >
              <p className="text-sm font-semibold line-clamp-2">{v.displayName}</p>
              <p className="text-xs text-slate-500 mt-1">
                {formatRelatedYear(v)}
                {formatRelatedYear(v) ? ' · ' : ''}
                FIPE {v.fipeCodigo}
              </p>
              <p className="text-sm font-bold text-blue-600 mt-1 tabular-nums">{formatBRL(v.valorAtual)}</p>
            </Link>
          ))}
        </div>
      </section>

      {hubKind === 'familia' && marcaSlug && (
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link to={`/fipe/${marcaSlug}/`} className="text-blue-600 font-semibold min-h-[44px] inline-flex items-center">
            Ver todos os modelos da marca →
          </Link>
        </nav>
      )}

      <nav className="text-xs pt-4 border-t border-slate-200 dark:border-slate-800">
        <Link to="/" className="text-blue-600 font-semibold">
          ← Nova pesquisa
        </Link>
      </nav>
    </div>
  );
}
