/**
 * Recalls — campanhas publicadas em sites oficiais das montadoras (dados publicos).
 * Nota: API Senatran bulk nao e publica; consulta por chassi exige Gov.br.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../../lib/fipe-paths.js';

interface RecallRecord {
  id: string;
  marca: string;
  modelo: string;
  anoInicio?: number;
  anoFim?: number;
  titulo: string;
  status: string;
  data?: string;
  fonte: string;
}

const OEM_RECALL_PAGES: { marca: string; url: string }[] = [
  { marca: 'TOYOTA', url: 'https://www.toyota.com.br/meu-toyota/servicos/recall' },
  { marca: 'NISSAN', url: 'https://www.nissan.com.br/proprietarios/recall.html' },
  { marca: 'HONDA', url: 'https://www.honda.com.br/recall' },
  { marca: 'HYUNDAI', url: 'https://www.hyundai.com.br/recall' },
  { marca: 'JEEP', url: 'https://www.jeep.com.br/recall.html' },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRecallPage(html: string, marca: string, url: string): RecallRecord[] {
  const text = stripHtml(html);
  const records: RecallRecord[] = [];
  const re = /(recall|campanha|convoca)[^.]{10,200}/gi;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) && i < 30) {
    const titulo = m[0].trim().slice(0, 180);
    if (titulo.length < 20) continue;
    records.push({
      id: `${marca.toLowerCase()}-${i++}`,
      marca,
      modelo: '',
      titulo,
      status: 'ativo',
      fonte: url,
    });
  }
  return records;
}

async function main() {
  fs.mkdirSync(PATHS.rawRecalls, { recursive: true });
  fs.mkdirSync(path.dirname(PATHS.normalizedRecalls), { recursive: true });

  const records: RecallRecord[] = [];
  for (const page of OEM_RECALL_PAGES) {
    try {
      const res = await fetch(page.url, {
        headers: { 'User-Agent': 'consulta-tabela-fipe/1.0 (dados-publicos)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        console.warn(page.marca, res.status);
        continue;
      }
      const html = await res.text();
      fs.writeFileSync(path.join(PATHS.rawRecalls, `${page.marca.toLowerCase()}-raw.html`), html);
      records.push(...parseRecallPage(html, page.marca, page.url));
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.warn(page.marca, e);
    }
  }

  if (!records.length && fs.existsSync(PATHS.normalizedRecalls)) {
    const cached = JSON.parse(fs.readFileSync(PATHS.normalizedRecalls, 'utf-8')) as RecallRecord[];
    fs.writeFileSync(PATHS.normalizedRecalls, JSON.stringify(cached, null, 2));
    console.log(JSON.stringify({ registros: cached.length, fonte: 'cache' }, null, 2));
    return;
  }

  fs.writeFileSync(PATHS.normalizedRecalls, JSON.stringify(records, null, 2));
  console.log(JSON.stringify({ registros: records.length, output: PATHS.normalizedRecalls }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
