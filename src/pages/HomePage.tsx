import { Link } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import { useSearchIndex, getMarcasFromIndex, getPopularItems } from '../hooks/useSearchIndex';
import { usePageMeta } from '../hooks/usePageMeta';
import { vehiclePath } from '../lib/slug';
import { marcaPath } from '../lib/seo-routes';
import { VehicleTipo } from '../types';
import { useState } from 'react';

export default function HomePage() {
  const { index, loading, error, total, ensureShardsForQuery } = useSearchIndex();
  const [tipo, setTipo] = useState<VehicleTipo>('carros');
  const popular = getPopularItems(index);
  const marcas = getMarcasFromIndex(index).slice(0, 16);

  usePageMeta({
    title: 'PesquisaTabelaFIPE — Consulta FIPE Gratuita',
    description:
      'Consulte o preço do seu carro, moto ou caminhão na Tabela FIPE. Busca rápida — digite marca, modelo ou ano.',
    path: '/',
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20 text-center space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
          Quanto vale seu veículo?
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Consulta gratuita · {loading ? '...' : `${(total || index.length).toLocaleString('pt-BR')}`} veículos ·
          Sem cadastro
        </p>
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="relative">
        <SearchBox
          index={index}
          onQueryChange={ensureShardsForQuery}
          tipo={tipo}
          onTipoChange={setTipo}
          autoFocus={false}
          size="hero"
        />
      </div>

      {popular.length > 0 && (
        <div className="space-y-3 text-left sm:text-center">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            Mais consultados
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {popular.map((item) => (
              <Link
                key={item.id}
                to={vehiclePath(item.marca ?? 'geral', item.id)}
                className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors min-h-[44px] flex items-center"
              >
                {item.nome.replace(/\s*\(\d{4}\)\s*$/, '')}
              </Link>
            ))}
          </div>
        </div>
      )}

      {marcas.length > 0 && (
        <div className="space-y-3">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            Navegar por marca
          </span>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {marcas.map((m) => (
              <Link
                key={m}
                to={marcaPath(m)}
                className="capitalize hover:text-blue-600 min-h-[44px] inline-flex items-center"
              >
                {m}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
