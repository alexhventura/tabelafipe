/**
 * Descobre URLs oficiais de PDFs PBEV na pagina INMETRO e atualiza catalogo.
 */
import fs from 'fs';
import { PATHS } from '../../lib/fipe-paths.js';

const PAGE_BASE = 'https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular';

function parsePdfLinks(html: string, found: Map<string, string>) {
  const dlRe = /href="([^"]+\/@@download\/file)"[\s\S]*?\n\s*([^<\n]+\.pdf)/gi;
  let m: RegExpExecArray | null;
  while ((m = dlRe.exec(html))) {
    let url = m[1].replace(/&amp;/g, '&');
    if (url.startsWith('/')) url = `https://www.gov.br${url}`;
    const arquivo = m[2].trim();
    if (!arquivo.toLowerCase().endsWith('.pdf')) continue;
    found.set(arquivo, url);
  }

  const directRe = /href="([^"]+\.pdf\/@@download\/file)"/gi;
  while ((m = directRe.exec(html))) {
    let url = m[1].replace(/&amp;/g, '&');
    if (url.startsWith('/')) url = `https://www.gov.br${url}`;
    const slug = url.split('/').find((p) => p.endsWith('.pdf')) ?? '';
    const arquivo = decodeURIComponent(slug);
    if (arquivo.endsWith('.pdf') && !found.has(arquivo)) found.set(arquivo, url);
  }
}

function safeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
}

async function main() {
  const found = new Map<string, string>();
  for (const page of ['', '?b_start:int=20']) {
    const res = await fetch(`${PAGE_BASE}${page}`, { headers: { 'User-Agent': 'consulta-tabela-fipe/1.0' } });
    parsePdfLinks(await res.text(), found);
  }

  const catalog = JSON.parse(fs.readFileSync(PATHS.inmetroPbevCatalog, 'utf-8')) as { edicoes: unknown[]; historicos: unknown[] };
  const edicoes = [...found.entries()].map(([arquivo, url], i) => ({
    id: `pbev-${safeFilename(arquivo).replace(/\.pdf$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
    arquivo: safeFilename(arquivo),
    url,
    prioridade: i + 1,
  }));

  const updated = { ...catalog, geradoEm: new Date().toISOString().slice(0, 10), edicoes, descobertos: edicoes.length };
  fs.writeFileSync(PATHS.inmetroPbevCatalog, JSON.stringify(updated, null, 2));
  console.log(JSON.stringify({ descobertos: edicoes.length, amostra: edicoes.slice(0, 8) }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });