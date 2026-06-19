import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FaqItem } from '../../lib/faq';

interface FaqSectionProps {
  items: FaqItem[];
}

export default function FaqSection({ items }: FaqSectionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section aria-label="Perguntas frequentes" className="space-y-3">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Perguntas frequentes</h2>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left min-h-[48px]"
              aria-expanded={openIdx === idx}
            >
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {item.pergunta}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                  openIdx === idx ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openIdx === idx && (
              <div className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                {item.resposta}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
