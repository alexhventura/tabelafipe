import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { SearchIndexItem, VehicleTipo } from '../../types';
import { searchVehicles, looksLikeMotoQuery } from '../../lib/search';
import { formatBRL } from '../../lib/format';
import { vehiclePath } from '../../lib/slug';

interface SearchBoxProps {
  index: SearchIndexItem[];
  tipo?: VehicleTipo;
  onTipoChange?: (tipo: VehicleTipo) => void;
  initialQuery?: string;
  autoFocus?: boolean;
  size?: 'hero' | 'compact';
  showTabs?: boolean;
}

const TIPOS: { id: VehicleTipo; label: string }[] = [
  { id: 'carros', label: 'Carros' },
  { id: 'motos', label: 'Motos' },
  { id: 'caminhoes', label: 'Caminhões' },
];

export default function SearchBox({
  index,
  tipo: tipoProp,
  onTipoChange,
  initialQuery = '',
  autoFocus = false,
  size = 'hero',
  showTabs = true,
}: SearchBoxProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [tipo, setTipo] = useState<VehicleTipo>(tipoProp ?? 'carros');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return searchVehicles(index, query, tipo, 8);
  }, [index, query, tipo]);

  const motoHint = looksLikeMotoQuery(query) && tipo === 'carros' && results.length === 0;

  const goToVehicle = useCallback(
    (item: SearchIndexItem) => {
      setOpen(false);
      setQuery('');
      navigate(vehiclePath(item.marca ?? 'geral', item.id));
    },
    [navigate],
  );

  const goToResults = useCallback(() => {
    if (!query.trim()) return;
    setOpen(false);
    navigate(`/busca?q=${encodeURIComponent(query.trim())}&tipo=${tipo}`);
  }, [navigate, query, tipo]);

  const handleSubmit = useCallback(() => {
    if (results.length === 1) {
      goToVehicle(results[0]);
    } else if (results.length > 0) {
      goToVehicle(results[activeIdx] ?? results[0]);
    } else {
      goToResults();
    }
  }, [results, activeIdx, goToVehicle, goToResults]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (tipoProp) setTipo(tipoProp);
  }, [tipoProp]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const inputClasses = size === 'hero' ? 'text-base py-4' : 'text-sm py-2.5';

  const dropdown = open && query.trim().length >= 2 && (
    <div
      id="search-dropdown-menu"
      role="listbox"
      className={`z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden ${
        size === 'hero'
          ? 'relative mt-1 w-full'
          : 'fixed left-4 right-4 max-w-3xl mx-auto top-[72px] max-h-[min(60vh,400px)] overflow-y-auto'
      }`}
      style={size !== 'hero' ? { marginLeft: 'auto', marginRight: 'auto' } : undefined}
    >
      {results.length > 0 ? (
        <>
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
            {results.length} resultado{results.length > 1 ? 's' : ''}
          </div>
          {results.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={idx === activeIdx}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => goToVehicle(item)}
              className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors min-h-[56px] ${
                idx === activeIdx
                  ? 'bg-blue-50 dark:bg-blue-950/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                  {item.nome.replace(/\s*\(\d{4}\)\s*$/, '')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.combustivel ?? 'Flex'}
                  {item.ano ? ` · ${item.ano}` : ''}
                </p>
              </div>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0 tabular-nums">
                {formatBRL(item.valor)}
              </span>
            </button>
          ))}
          {results.length >= 8 && (
            <button
              type="button"
              onClick={goToResults}
              className="w-full px-4 py-3 text-xs font-semibold text-blue-600 dark:text-blue-400 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 min-h-[44px]"
            >
              Ver todos os resultados para &quot;{query}&quot; →
            </button>
          )}
        </>
      ) : (
        <div className="p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Nenhum veículo encontrado
          </p>
          {motoHint ? (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Parece uma moto — selecione a aba <strong>Motos</strong> acima.
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              Tente: Gol 2015, Onix 2019, Corolla 2021
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="w-full space-y-3">
      <div
        className={`relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 ${
          size === 'hero' ? 'rounded-2xl shadow-md' : ''
        }`}
      >
        <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" strokeWidth={1.5} aria-hidden />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="Pesquisar veículo..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          className={`w-full bg-transparent focus:outline-none text-slate-900 dark:text-white placeholder-slate-400 ${inputClasses}`}
          id="main-fipe-search-input"
          aria-label="Pesquisar veículo"
          aria-expanded={open && query.trim().length >= 2}
          aria-controls="search-dropdown-menu"
          aria-autocomplete="list"
        />
      </div>

      {size === 'hero' && (
        <p className="text-xs text-slate-400 text-center">
          Ex: Corolla, Onix LT 2024, CG 160, Renegade Diesel
        </p>
      )}

      {showTabs && (
        <div className="flex justify-center gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTipo(t.id);
                onTipoChange?.(t.id);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${
                tipo === t.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {dropdown}
    </div>
  );
}
