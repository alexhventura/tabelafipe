import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  searchVehicles,
  searchFamilies,
  extractFilterChips,
  formatFamilyLabel,
  formatFamilyMeta,
} from '../lib/search';
import { formatBRL } from '../lib/format';
import { vehiclePath } from '../lib/slug';
import { VehicleTipo } from '../types';

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const tipoParam = (searchParams.get('tipo') as VehicleTipo) ?? 'carros';
  const { index, families } = useSearchIndex();
  const [yearFilter, setYearFilter] = useState<string | null>(null);

  const familyResults = useMemo(
    () => searchFamilies(families, query, tipoParam, 12),
    [families, query, tipoParam],
  );

  const baseResults = useMemo(
    () => searchVehicles(index, query, tipoParam, 100),
    [index, query, tipoParam],
  );

  const yearChips = useMemo(
    () => extractFilterChips(index, query, tipoParam),
    [index, query, tipoParam],
  );

  const results = useMemo(() => {
    if (!yearFilter) return baseResults;
    return baseResults.filter((r) => String(r.ano) === yearFilter);
  }, [baseResults, yearFilter]);

  usePageMeta({
    title: `Pesquisa: ${query || 'veículos'} — PesquisaTabelaFIPE`,
    description: `${results.length} veículos encontrados para "${query}" na Tabela FIPE.`,
    path: `/busca?q=${encodeURIComponent(query)}&tipo=${tipoParam}`,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <SearchBox
        index={index}
        families={families}
        initialQuery={query}
        tipo={tipoParam}
        size="compact"
        showTabs={false}
      />

      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {familyResults.length + results.length} resultado
          {familyResults.length + results.length !== 1 ? 's' : ''} para &quot;{query}&quot;
        </h1>
      </div>

      {familyResults.length > 0 && (
        <section className="space-y-3" aria-label="Famílias">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Famílias</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {familyResults.map((item) => (
              <Link
                key={item.id}
                to={item.hubPath ?? `/fipe/${item.marcaSlug}/${item.familia}/`}
                className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-blue-500 transition-colors"
              >
                <p className="text-sm font-bold text-slate-900 dark:text-white">{formatFamilyLabel(item)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatFamilyMeta(item)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {yearChips.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setYearFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] ${
              !yearFilter
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Todos
          </button>
          {yearChips.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYearFilter(y)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] ${
                yearFilter === y
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {results.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12">
            Nenhum veículo encontrado. Tente termos como Gol 2015 ou Onix 2019.
          </p>
        ) : (
          results.map((item) => (
            <Link
              key={item.id}
              to={item.canonicalPath ?? vehiclePath(item.marca ?? 'geral', item.id)}
              className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.nome.replace(/\s*\(\d{4}\)\s*$/, '')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.combustivel} · Cód. FIPE {item.fipeCodigo ?? '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {formatBRL(item.valor)}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
