import { Link } from 'react-router-dom';
import { formatYearLabel } from '../../lib/displayYear';
import { formatBRL } from '../../lib/format';
import { AlternativeItem } from '../../lib/alternatives';

interface AlternativesSectionProps {
  alternatives: AlternativeItem[];
  modeloNome: string;
}

export default function AlternativesSection({ alternatives, modeloNome }: AlternativesSectionProps) {
  if (alternatives.length === 0) return null;

  return (
    <section aria-label="Alternativas semelhantes" className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
        Alternativas ao {modeloNome}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {alternatives.map((alt) => (
          <Link
            key={alt.id}
            to={alt.href}
            className="snap-start shrink-0 w-[160px] sm:w-[180px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-blue-500 transition-colors"
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">
              {alt.nome}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">{formatYearLabel(alt.ano) || '—'}</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-2">
              {formatBRL(alt.valor)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
