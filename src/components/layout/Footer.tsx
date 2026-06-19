export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 mt-auto">
      <div className="max-w-5xl mx-auto px-4 text-center space-y-2">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
          Valores referenciais da Tabela FIPE (FIPE/USP). Este site não possui vínculo oficial com a
          Fundação Instituto de Pesquisas Econômicas.
        </p>
        <p className="text-[10px] text-slate-400">
          © {new Date().getFullYear()} pesquisatabelafipe.com.br
        </p>
      </div>
    </footer>
  );
}
