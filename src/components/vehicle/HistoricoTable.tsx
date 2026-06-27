import type { HistoricoPonto } from '../../types/bundle';
import { formatBRL } from '../../lib/format';

interface HistoricoTableProps {
  historico: HistoricoPonto[];
  /** Máximo de linhas exibidas (mais recentes primeiro). */
  maxRows?: number;
}

function mesLabel(ponto: HistoricoPonto): string {
  return ponto.referencia ?? ponto.mes ?? ponto.data ?? '—';
}

export default function HistoricoTable({ historico, maxRows = 12 }: HistoricoTableProps) {
  if (!historico.length) return null;

  const rows = [...historico].reverse().slice(0, maxRows);

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">Histórico de preços FIPE por mês de referência</caption>
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th
              scope="col"
              className="text-left py-2.5 pr-4 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Mês de referência
            </th>
            <th
              scope="col"
              className="text-right py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Valor FIPE
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ponto, idx) => {
            const label = mesLabel(ponto);
            return (
              <tr
                key={`${label}-${ponto.valor}-${idx}`}
                className="border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">{label}</td>
                <td className="py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatBRL(ponto.valor)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
