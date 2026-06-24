import { ChevronRight, Loader2, Search } from 'lucide-react';
import { useEffect } from 'react';
import type { VehicleTipo } from '../../types';
import { formatBRL } from '../../lib/format';
import { formatGuidedYear, formatFamilyLabel } from '../../lib/guidedSearch';
import { useGuidedSearch } from '../../hooks/useGuidedSearch';

const STEPS = [
  { id: 'marca' as const, label: 'Montadora' },
  { id: 'modelo' as const, label: 'Modelo' },
  { id: 'versao' as const, label: 'Versão' },
  { id: 'ano' as const, label: 'Ano' },
];

interface Props {
  tipo: VehicleTipo;
  onTipoChange?: (tipo: VehicleTipo) => void;
  showTabs?: boolean;
}

function StepSearch({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        autoComplete="off"
      />
    </div>
  );
}

export default function GuidedFipeSearch({ tipo, onTipoChange, showTabs = true }: Props) {
  const guided = useGuidedSearch(tipo);

  useEffect(() => {
    guided.resetTipo();
  }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepIndex = STEPS.findIndex((s) => s.id === guided.step);

  return (
    <div className="w-full space-y-4" aria-label="Consulta FIPE guiada">
      {showTabs && onTipoChange && (
        <div className="flex justify-center gap-2">
          {(
            [
              { id: 'carros' as const, label: 'Carros' },
              { id: 'motos' as const, label: 'Motos' },
              { id: 'caminhoes' as const, label: 'Caminhões' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTipoChange(t.id)}
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

      <nav aria-label="Progresso da consulta" className="flex items-center gap-1 text-[11px] text-slate-600 flex-wrap">
        {STEPS.map((s, i) => (
          <span key={s.id} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3" aria-hidden />}
            <button
              type="button"
              disabled={i > stepIndex}
              onClick={() => guided.resetFrom(s.id)}
              className={`min-h-[32px] px-1 rounded ${
                guided.step === s.id
                  ? 'text-blue-600 font-bold'
                  : i < stepIndex
                    ? 'text-slate-600 hover:text-blue-600'
                    : 'text-slate-500 cursor-default'
              }`}
            >
              {s.label}
            </button>
          </span>
        ))}
      </nav>

      {(guided.marca || guided.modelo || guided.versao) && (
        <p className="text-xs text-slate-500 truncate">
          {[guided.marca?.nome, guided.modelo && formatFamilyLabel(guided.modelo), guided.versao?.label]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 min-h-[280px]">
        {guided.step === 'marca' && (
          <>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Qual a montadora?</h2>
              <p className="text-xs text-slate-500 min-h-4">
                {guided.marcasLoading ? '\u00a0' : `${guided.counts.marcas} opções`}
              </p>
            </div>
            <StepSearch
              id="guided-marca-search"
              value={guided.marcaQuery}
              onChange={guided.setMarcaQuery}
              placeholder="Filtrar montadoras..."
            />
            <div className="min-h-[min(42vh,320px)]">
              {guided.marcasLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-600 text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando montadoras...
                </div>
              ) : guided.marcasFiltradas.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Nenhuma montadora encontrada.</p>
              ) : (
                <ul className="max-h-[min(42vh,320px)] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 -mx-1">
                  {guided.marcasFiltradas.map((m) => (
                    <li key={m.slug}>
                      <button
                        type="button"
                        onClick={() => guided.selectMarca(m)}
                        className="w-full px-3 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors min-h-[48px] flex items-center justify-between gap-2"
                      >
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{m.nome}</span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 shrink-0">
                          {m.totalModelos} modelos
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {guided.step === 'modelo' && guided.marca && (
          <>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Qual o modelo <span className="text-blue-600">{guided.marca.nome}</span>?
              </h2>
              <p className="text-xs text-slate-500 min-h-4">
                {guided.familiesLoading ? '\u00a0' : `${guided.counts.modelos} opções`}
              </p>
            </div>
            <StepSearch
              id="guided-modelo-search"
              value={guided.modeloQuery}
              onChange={guided.setModeloQuery}
              placeholder="Filtrar modelos..."
            />
            <div className="min-h-[min(42vh,320px)]">
              {guided.familiesLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-600 text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando modelos...
                </div>
              ) : guided.modelosFiltrados.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Nenhum modelo encontrado.</p>
              ) : (
                <ul className="max-h-[min(42vh,320px)] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 -mx-1">
                  {guided.modelosFiltrados.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => guided.selectModelo(f)}
                        className="w-full px-3 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors min-h-[48px] flex items-center justify-between gap-2"
                      >
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatFamilyLabel(f)}
                        </span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 shrink-0">
                          {f.versaoCount} versões
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {guided.step === 'versao' && guided.marca && guided.modelo && (
          <>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Qual a versão do {formatFamilyLabel(guided.modelo)}?
              </h2>
              <p className="text-xs text-slate-500 min-h-4">
                {guided.hubLoading ? '\u00a0' : `${guided.counts.versoes} opções`}
              </p>
            </div>
            <StepSearch
              id="guided-versao-search"
              value={guided.versaoQuery}
              onChange={guided.setVersaoQuery}
              placeholder="Filtrar versões..."
            />
            <div className="min-h-[min(42vh,320px)]">
              {guided.hubLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-600 text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando versões...
                </div>
              ) : (
                <ul className="max-h-[min(42vh,320px)] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 -mx-1">
                  {guided.versoesFiltradas.map((v) => (
                    <li key={v.fipeCodigo}>
                      <button
                        type="button"
                        onClick={() => guided.selectVersao(v)}
                        className="w-full px-3 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors min-h-[56px]"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{v.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          FIPE {v.fipeCodigo} · {v.anos.length} anos
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {guided.step === 'ano' && guided.versao && (
          <>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Qual o ano do {guided.versao.label}?
              </h2>
              <p className="text-xs text-slate-500">{guided.counts.anos} opções · FIPE {guided.versao.fipeCodigo}</p>
            </div>
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[min(42vh,320px)] overflow-y-auto">
              {guided.versao.anos.map((ano) => {
                const vehicle = guided.versao!.vehicleByAno.get(ano);
                return (
                  <li key={ano}>
                    <button
                      type="button"
                      onClick={() => guided.selectAno(ano)}
                      className="w-full px-2 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors min-h-[56px] flex flex-col items-center justify-center gap-0.5"
                    >
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatGuidedYear(ano)}
                      </span>
                      {vehicle?.valorAtual ? (
                        <span className="text-[10px] text-blue-600 tabular-nums">{formatBRL(vehicle.valorAtual)}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
