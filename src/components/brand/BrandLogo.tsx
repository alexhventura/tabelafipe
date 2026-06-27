import { Link } from 'react-router-dom';
import { Car } from 'lucide-react';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  asLink?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 'w-8 h-8', icon: 'w-4 h-4', title: 'text-sm', sub: 'text-[9px]' },
  md: { box: 'w-10 h-10', icon: 'w-5 h-5', title: 'text-base', sub: 'text-[10px]' },
  lg: { box: 'w-14 h-14', icon: 'w-7 h-7', title: 'text-xl sm:text-2xl', sub: 'text-xs' },
};

export default function BrandLogo({ size = 'md', showText = true, asLink = true, className = '' }: Props) {
  const s = sizes[size];
  const inner = (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        className={`${s.box} rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/20 shrink-0`}
        aria-hidden
      >
        <Car className={s.icon} strokeWidth={1.75} />
      </div>
      {showText && (
        <div className="text-left">
          <span className={`${s.title} font-bold text-slate-900 dark:text-white leading-tight block`}>
            Pesquisa<span className="text-blue-600">Tabela</span>FIPE
          </span>
          {size === 'lg' && (
            <span className={`${s.sub} text-slate-500 dark:text-slate-400 font-medium`}>
              Portal automotivo de confiança
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link
        to="/"
        aria-label="Pesquisa Tabela FIPE — página inicial"
        className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
