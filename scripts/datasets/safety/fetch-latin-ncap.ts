/**
 * Latin NCAP — dados publicos de seguranca veicular.
 * Fontes: latinncap.com/po/resultados + PDF oficial de estrelas (desde 2020).
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../../lib/fipe-paths.js';

const NCAP_RESULTS_URL = 'https://www.latinncap.com/po/resultados';
const NCAP_PDF_URL =
  'https://www.latinncap.com/data/descargas/LatinNCAP_todos_los_resultados_desde_2020.pdf';

export interface NcapRecord {
  marca: string;
  modelo: string;
  ano?: number;
  notaGeral?: number;
  protecaoAdultos?: number;
  protecaoInfantis?: number;
  protecaoPedestre?: number;
  assistenciaSeguranca?: number;
  airbags?: number;
  dataTeste?: string;
  fonte: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMarcaModelo(title: string): { marca: string; modelo: string; airbags?: number } {
  const air = title.match(/\+\s*(\d+)\s*Airbags?/i);
  const cleaned = title.replace(/\s*\+\s*\d+\s*Airbags?/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return { marca: cleaned, modelo: cleaned };
  return { marca: parts[0], modelo: parts.slice(1).join(' '), airbags: air ? parseInt(air[1], 10) : undefined };
}

function parseResultsHtml(html: string): NcapRecord[] {
  const records: NcapRecord[] = [];
  const blocks = html.split(/<h3[^>]*>/i).slice(1);
  for (const block of blocks) {
    const end = block.indexOf('</h3>');
    if (end < 0) continue;
    const title = stripHtml(block.slice(0, end));
    if (!title || title.length < 4 || /classificar|resultados por/i.test(title)) continue;

    const { marca, modelo, airbags } = parseMarcaModelo(title);
    const rest = stripHtml(block.slice(end));
    const dateMatch = rest.match(
      /(Janeiro|Fevereiro|Mar[cç]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)-(\d{4})/i,
    );
    const pcts = [...rest.matchAll(/(\d{1,3})%/g)].map((m) => parseInt(m[1], 10));
    if (pcts.length < 4) continue;

    records.push({
      marca,
      modelo,
      ano: dateMatch ? parseInt(dateMatch[2], 10) : undefined,
      protecaoAdultos: pcts[0],
      protecaoInfantis: pcts[1],
      protecaoPedestre: pcts[2],
      assistenciaSeguranca: pcts[3],
      airbags,
      dataTeste: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}` : undefined,
      fonte: NCAP_RESULTS_URL,
    });
  }
  return records;
}

function normKey(marca: string, modelo: string): string {
  return `${marca.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}|${modelo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')}`;
}

/** PDF: linhas MARCA MODELO ... N estrelas */
function parseStarsPdfText(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z][A-Z\s-]+?)\s+([A-Z0-9][A-Z0-9\s/+\-*]+?)\s+(\d+)\s+(\d)\s*$/i);
    if (!m) continue;
    const marca = m[1].trim();
    const modelo = m[2].trim().replace(/\s+/g, ' ');
    const stars = parseInt(m[4], 10);
    if (stars >= 0 && stars <= 5) map.set(normKey(marca, modelo), stars);
  }
  return map;
}

async function fetchPdfStars(): Promise<Map<string, number>> {
  const pdfPath = path.join(PATHS.rawSafety, 'latin-ncap-stars-2020.pdf');
  try {
    const res = await fetch(NCAP_PDF_URL, {
      headers: { 'User-Agent': 'consulta-tabela-fipe/1.0 (dados-publicos)' },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return new Map();
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(PATHS.rawSafety, { recursive: true });
    fs.writeFileSync(pdfPath, buf);
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    await parser.destroy();
    return parseStarsPdfText(result.text ?? '');
  } catch (e) {
    console.warn('PDF Latin NCAP indisponivel:', e);
    return new Map();
  }
}

function mergeStars(records: NcapRecord[], stars: Map<string, number>): void {
  for (const r of records) {
    const keys = [
      normKey(r.marca, r.modelo),
      normKey(r.marca, r.modelo.split('/')[0].trim()),
      normKey(r.marca, r.modelo.split(' ')[0]),
    ];
    for (const k of keys) {
      const s = stars.get(k);
      if (s != null) {
        r.notaGeral = s;
        break;
      }
    }
    if (r.notaGeral == null && r.protecaoAdultos != null) {
      const avg = (r.protecaoAdultos + (r.protecaoInfantis ?? 0)) / 2;
      r.notaGeral = avg >= 90 ? 5 : avg >= 75 ? 4 : avg >= 60 ? 3 : avg >= 45 ? 2 : 1;
    }
  }
}

async function main() {
  fs.mkdirSync(PATHS.rawSafety, { recursive: true });
  fs.mkdirSync(path.dirname(PATHS.normalizedSafety), { recursive: true });

  let records: NcapRecord[] = [];
  const rawFile = path.join(PATHS.rawSafety, 'latin-ncap-raw.html');

  try {
    const res = await fetch(NCAP_RESULTS_URL, {
      headers: { 'User-Agent': 'consulta-tabela-fipe/1.0 (dados-publicos)' },
      signal: AbortSignal.timeout(45000),
    });
    const html = await res.text();
    fs.writeFileSync(rawFile, html);
    if (!res.ok) console.warn('NCAP HTTP', res.status);
    records = parseResultsHtml(html);
  } catch (e) {
    console.warn('Fetch NCAP HTML falhou:', e);
    if (fs.existsSync(rawFile)) records = parseResultsHtml(fs.readFileSync(rawFile, 'utf-8'));
  }

  const stars = await fetchPdfStars();
  mergeStars(records, stars);

  if (!records.length && fs.existsSync(PATHS.normalizedSafety)) {
    records = JSON.parse(fs.readFileSync(PATHS.normalizedSafety, 'utf-8'));
  }

  fs.writeFileSync(PATHS.normalizedSafety, JSON.stringify(records, null, 2));
  console.log(
    JSON.stringify(
      { registros: records.length, comEstrelas: records.filter((r) => r.notaGeral != null).length, output: PATHS.normalizedSafety },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
