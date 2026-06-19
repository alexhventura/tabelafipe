import { Link } from 'react-router-dom';
import { Car } from 'lucide-react';

interface HeaderProps {
  mesReferencia?: string;
}

export default function Header({ mesReferencia = 'Jun/2026' }: HeaderProps) {
  return (
    <header className="border-b border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group" id="logo-container">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Car className="w-4.5 h-4.5" strokeWidth={1.5} />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 dark:text-white leading-none block">
              Pesquisa<span className="text-blue-600">Tabela</span>FIPE
            </span>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
              Consulta gratuita
            </span>
          </div>
        </Link>
        <span className="text-[10px] text-slate-400 font-medium hidden sm:block">
          Atualizado {mesReferencia}
        </span>
      </div>
    </header>
  );
}
