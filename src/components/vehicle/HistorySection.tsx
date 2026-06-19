import { lazy, Suspense } from 'react';
import { Vehicle } from '../../types';

const PriceChart = lazy(() => import('./PriceChart'));

interface HistorySectionProps {
  vehicle: Vehicle;
}

export default function HistorySection({ vehicle }: HistorySectionProps) {
  return (
    <section aria-label="Histórico de preço" className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Histórico de preço</h2>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 min-h-[200px]">
        <Suspense
          fallback={
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">
              Carregando gráfico...
            </div>
          }
        >
          <PriceChart data={vehicle.historicoPrecos} />
        </Suspense>
      </div>
    </section>
  );
}
