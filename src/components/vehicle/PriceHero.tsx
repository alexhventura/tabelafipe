import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatBRL, formatPct } from '../../lib/format';

interface PriceHeroProps {
  valor: number;
  trend6m: number | null;
  mesReferencia?: string;
}

export default function PriceHero({ valor, trend6m, mesReferencia = 'Jun/2026' }: PriceHeroProps) {
  const valorizando = trend6m !== null && trend6m >= 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <span className="text-[10px] uppercase tracking-widest text-slate-600 dark:text-slate-400 font-bold block mb-1">
        Tabela FIPE · {mesReferencia}
      </span>
      <div className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
        {formatBRL(valor)}
      </div>
      {trend6m !== null && (
        <div className="mt-3">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
              valorizando
                ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400'
                : 'text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400'
            }`}
          >
            {valorizando ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {valorizando ? 'Valorização' : 'Desvalorização'} {formatPct(Math.abs(trend6m))} (6 meses)
          </span>
        </div>
      )}
    </div>
  );
}
