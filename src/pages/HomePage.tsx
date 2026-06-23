import { Link } from 'react-router-dom';
import SearchBox from '../components/search/SearchBox';
import { useSearchIndex } from '../hooks/useSearchIndex';
import { usePageMeta } from '../hooks/usePageMeta';
import { VehicleTipo } from '../types';
import { useState } from 'react';

export default function HomePage() {
  const { index, loading, error, total, ensureShardsForQuery } = useSearchIndex();
  const [tipo, setTipo] = useState<VehicleTipo>('carros');

  usePageMeta({
    title: 'PesquisaTabelaFIPE — Consulta FIPE Gratuita',
    description: 'Consulte o preço FIPE de carros, motos e caminhões. Digite marca, modelo, versão ou código FIPE.',
    path: '/',
  });

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-center max-w-xl mx-auto px-4 py-10 sm:py-16">
      <div className="text-center space-y-8 w-full">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Consulta Tabela FIPE
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Carregando catálogo...' : `${(total || index.length).toLocaleString('pt-BR')} veículos`}
          </p>
        </div>

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg px-4 py-2">{error}</p>
        )}

        <div className="w-full" role="search" aria-label="Busca de veículos">
          <SearchBox
            index={index}
            onQueryChange={ensureShardsForQuery}
            tipo={tipo}
            onTipoChange={setTipo}
            autoFocus
            size="hero"
            showTabs
          />
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Ex: <span className="text-slate-500">Corolla</span> ·{' '}
          <span className="text-slate-500">Onix LT 2024</span> ·{' '}
          <span className="text-slate-500">002112-1</span>
        </p>
      </div>

      <footer className="mt-auto pt-12 text-center">
        <Link to="/busca" className="text-xs text-slate-400 hover:text-blue-600">
          Busca avançada
        </Link>
      </footer>
    </div>
  );
}
