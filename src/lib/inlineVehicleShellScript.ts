/**
 * Script síncrono injetado no HTML antes do bundle React.
 * Envolve `<main data-prerender="vehicle">` parcial com header/footer estáticos
 * para eliminar CLS do footer na hidratação.
 */
import { buildStaticFooterHtml, buildStaticHeaderHtml } from './staticShellHtml';

export function buildInlineVehicleShellScriptContent(): string {
  const year = new Date().getFullYear();
  const header = JSON.stringify(buildStaticHeaderHtml());
  const footer = JSON.stringify(buildStaticFooterHtml(year));

  return `(function(){
  var root=document.getElementById('root');
  if(!root||root.querySelector('.min-h-screen footer.border-t'))return;
  var prerender=root.querySelector('[data-prerender="vehicle"]');
  if(!prerender)return;
  var header=${header};
  var footer=${footer};
  var inner=prerender.tagName==='MAIN'
    ?'<div data-prerender="vehicle">'+prerender.innerHTML+'</div>'
    :prerender.outerHTML;
  root.innerHTML='<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-x-hidden">'
    +header+'<main class="flex-1 w-full">'+inner+'</main>'+footer+'</div>';
})();`;
}

export function buildInlineVehicleShellScriptTag(): string {
  return `<script>${buildInlineVehicleShellScriptContent()}</script>`;
}
