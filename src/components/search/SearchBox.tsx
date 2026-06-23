import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { FamilySearchItem, SearchIndexItem, SearchSuggestion, VehicleTipo } from '../../types';
import {
  searchSuggestions,
  looksLikeMotoQuery,
  formatVehicleSuggestionTitle,
  formatVehicleSuggestionSubtitle,
  isHighConfidenceMatch,
  AUTOCOMPLETE_LIMIT,
} from '../../lib/search';
import { formatBRL } from '../../lib/format';
import { vehiclePath, vehicleCanonicalPath } from '../../lib/slug';

interface SearchBoxProps {
  index: SearchIndexItem[];
  families?: FamilySearchItem[];
  onQueryChange?: (query: string) => void;
  tipo?: VehicleTipo;
  onTipoChange?: (tipo: VehicleTipo) => void;
  initialQuery?: string;
  autoFocus?: boolean;
  size?: 'hero' | 'compact';
  showTabs?: boolean;
  hideLabel?: boolean;
  hideInlineExamples?: boolean;
  placeholder?: string;
  onActivate?: () => void;
}

const TIPOS: { id: VehicleTipo; label: string }[] = [
  { id: 'carros', label: 'Carros' },
  { id: 'motos', label: 'Motos' },
  { id: 'caminhoes', label: 'Caminhões' },
];

export default function SearchBox({
  index,
  families = [],
  onQueryChange,
  tipo: tipoProp,
  onTipoChange,
  initialQuery = '',
  autoFocus = false,
  size = 'hero',
  showTabs = true,
  hideLabel = false,
  hideInlineExamples = false,
  placeholder = 'Marca, modelo, versão, ano ou código FIPE',
  onActivate,
}: SearchBoxProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [tipo, setTipo] = useState<VehicleTipo>(tipoProp ?? 'carros');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 1) return [];
    return searchSuggestions(families, index, query, tipo, AUTOCOMPLETE_LIMIT);
  }, [families, index, query, tipo]);

  const highConfidence = useMemo(() => isHighConfidenceMatch(results), [results]);
  const motoHint = looksLikeMotoQuery(query) && tipo === 'carros' && results.length === 0;

  const goToVehicle = useCallback(
    (item: SearchIndexItem) => {
      setOpen(false);
      setQuery('');
      if (item.canonicalPath) {
        navigate(item.canonicalPath);
        return;
      }
      if (item.fipeCodigo && item.marca && item.ano) {
        const modelo = item.nome
          .replace(/\s*\(\d{4}\)\s*$/, '')
          .replace(new RegExp(`^${item.marca}\\s+`, 'i'), '')
          .trim();
        navigate(vehicleCanonicalPath(item.marca, modelo, item.ano, item.fipeCodigo));
        return;
      }
      navigate(vehiclePath(item.marca ?? 'geral', item.id));
    },
    [navigate],
  );

  const goToSuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      goToVehicle(suggestion.item);
    },
    [goToVehicle],
  );

  const goToResults = useCallback(() => {
    if (!query.trim()) return;
    setOpen(false);
    navigate(`/busca?q=${encodeURIComponent(query.trim())}&tipo=${tipo}`);
  }, [navigate, query, tipo]);

  const handleSubmit = useCallback(() => {
    if (highConfidence && results[0]) {
      goToSuggestion(results[0]);
      return;
    }
    if (results.length === 1) {
      goToSuggestion(results[0]);
    } else if (results.length > 0) {
      goToSuggestion(results[activeIdx] ?? results[0]);
    } else {
      goToResults();
    }
  }, [results, activeIdx, goToSuggestion, goToResults, highConfidence]);

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

  useEffect(() => {
    if (query.trim().length < 1) return;
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  const inputClasses = size === 'hero' ? 'text-base py-4' : 'text-sm py-2.5';

  const dropdown = open && query.trim().length >= 1 && (
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
          {highConfidence && (
            <div className="px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900 flex items-center justify-between gap-2">
              <span>Veículo encontrado — pressione Enter para abrir</span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-600/80">
                {Math.round((results[0]?.confidence ?? 0) * 100)}%
              </span>
            </div>
          )}
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
            {results.length} veículo{results.length > 1 ? 's' : ''}
          </div>
          {results.map((suggestion, idx) => (
            <button
              key={`${suggestion.item.id}-${idx}`}
              type="button"
              role="option"
              aria-selected={idx === activeIdx}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => goToSuggestion(suggestion)}
              className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors min-h-[56px] ${
                idx === activeIdx
                  ? 'bg-blue-50 dark:bg-blue-950/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                  {formatVehicleSuggestionTitle(suggestion.item)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatVehicleSuggestionSubtitle(suggestion.item)}
                </p>
              </div>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0 tabular-nums">
                {suggestion.item.valor > 0 ? formatBRL(suggestion.item.valor) : 'Consultar FIPE'}
              </span>
            </button>
          ))}
          {results.length >= AUTOCOMPLETE_LIMIT && (
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
              Tente: Gol, Onix, Corolla XEi 2024, 002112-1
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="w-full space-y-3">
      <label
        htmlFor="main-fipe-search-input"
        className={`block text-sm font-bold text-slate-900 dark:text-white ${hideLabel ? 'sr-only' : ''}`}
      >
        Buscar veículo
      </label>
      <div
        className={`relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 shadow-sm focus-within:border-blue-500 ${
          size === 'hero' ? 'rounded-2xl shadow-md' : ''
        } ${highConfidence && open ? 'border-emerald-500' : ''}`}
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
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => {
            onActivate?.();
            setOpen(true);
          }}
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
          role="combobox"
          aria-label="Buscar veículo na Tabela FIPE"
          aria-haspopup="listbox"
          aria-expanded={open && query.trim().length >= 1}
          aria-controls="search-dropdown-menu"
          aria-autocomplete="list"
        />
      </div>

      {size === 'hero' && !hideInlineExamples && (
        <p className="text-xs text-slate-400 text-center">
          Ex: Corolla XEi 2024, Onix, CG 160, 002112-1
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
