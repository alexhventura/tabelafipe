/**
 * Baixa PDFs oficiais PBEV do INMETRO para data/raw/inmetro/pdfs/
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../../lib/fipe-paths.js';

interface Edicao { id: string; arquivo: string; url: string; ano?: number; prioridade?: number }

async function download(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'consulta-tabela-fipe/1.0 (dataset-ingest)' } });
    if (!res.ok) { console.warn('HTTP', res.status, url); return false; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) { console.warn('Arquivo pequeno demais:', dest, buf.length); return false; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    return true;
  } catch (e) {
    console.warn('Falha download:', url, e);
    return false;
  }
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(PATHS.inmetroPbevCatalog, 'utf-8')) as { edicoes: Edicao[] };
  const pdfDir = path.join(PATHS.rawInmetro, 'pdfs');
  const only = process.argv.includes('--latest') ? catalog.edicoes.slice(0, 1)
    : process.argv.includes('--year') ? catalog.edicoes.filter((e) => String(e.ano) === process.argv[process.argv.indexOf('--year') + 1])
    : catalog.edicoes;

  const results: { id: string; ok: boolean; bytes?: number }[] = [];
  for (const ed of only) {
    const dest = path.join(pdfDir, ed.arquivo);
    if (fs.existsSync(dest) && !process.argv.includes('--force')) {
      results.push({ id: ed.id, ok: true, bytes: fs.statSync(dest).size });
      continue;
    }
    console.log('Baixando', ed.id, '...');
    const ok = await download(ed.url, dest);
    results.push({ id: ed.id, ok, bytes: ok ? fs.statSync(dest).size : undefined });
  }

  fs.writeFileSync(path.join(PATHS.rawInmetro, 'download-log.json'), JSON.stringify({ geradoEm: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify({ baixados: results.filter((r) => r.ok).length, total: results.length, results }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });