/**
 * Extrai registros PBEV de PDFs oficiais INMETRO.
 * Fonte: tabelas pipe-delimitadas no texto do PDF.
 */
import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { PATHS } from '../../lib/fipe-paths.js';
import { marcaSlug } from '../../lib/fipe-slug.js';

export interface PbevRawRecord {
  edicaoId: string;
  anoReferencia: number;
  categoria: string | null;
  marca: string;
  modelo: string;
  versao: string;
  combustivel: string | null;
  consumoCidadeGasolina: number | null;
  consumoEstradaGasolina: number | null;
  consumoCidadeEtanol: number | null;
  consumoEstradaEtanol: number | null;
  classificacaoPbe: string | null;
  eficienciaMjKm: number | null;
  linhaBruta: string;
}

const CATEGORIAS = [
  'Sub Compacto', 'Compacto', 'Médio', 'Grande', 'Picape Leve', 'Picape Média',
  'Utilitário Esportivo', 'Minivan', 'Perua Média', 'Perua Grande',
];

/** Nomes usados no PBEV que diferem do cadastro FIPE. */
const PBEV_MARCA_CANONICAL: Record<string, string> = {
  VW: 'VOLKSWAGEN',
  GM: 'CHEVROLET',
  'M.BENZ': 'MERCEDES-BENZ',
  'MERCEDES BENZ': 'MERCEDES-BENZ',
  CITROEN: 'CITROËN',
};

const PBEV_MARCA_EXTRA = ['VW', 'GM', 'M.BENZ', 'CITROEN', 'LAND ROVER', 'MINI', 'BYD', 'GWM'];

function canonicalMarca(marca: string): string {
  const upper = marca.toUpperCase().trim();
  return PBEV_MARCA_CANONICAL[upper] ?? upper;
}

function loadMarcas(): string[] {
  const marcas = JSON.parse(fs.readFileSync(PATHS.srcMarcas, 'utf-8')) as { nome: string }[];
  const all = [...marcas.map((m) => m.nome.toUpperCase()), ...PBEV_MARCA_EXTRA];
  return [...new Set(all)].sort((a, b) => b.length - a.length);
}

function marcaAtWordBoundary(text: string, marca: string): number {
  const re = new RegExp(`(?:^|\\s)${marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'i');
  const m = re.exec(text);
  if (!m) return -1;
  return m.index + (m[0].startsWith(' ') ? 1 : 0);
}

function parseNum(s: string | undefined): number | null {
  if (!s || s === '\\' || s === '-') return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseConsumoBlock(block: string) {
  const nums = block.replace(/\\/g, ' ').split(/\s+/).map(parseNum).filter((n): n is number => n !== null && n > 0 && n < 100);
  return {
    consumoCidadeGasolina: nums[0] ?? null,
    consumoEstradaGasolina: nums[1] ?? null,
    consumoCidadeEtanol: nums[2] ?? null,
    consumoEstradaEtanol: nums[3] ?? null,
  };
}

function parseClassificacao(block: string): { classificacaoPbe: string | null; eficienciaMjKm: number | null } {
  const letters = block.match(/\b([A-E])\b/g);
  const nums = block.split(/\s+/).map(parseNum).filter((n): n is number => n !== null);
  const mj = nums.find((n) => n > 0.5 && n < 5) ?? null;
  return { classificacaoPbe: letters?.[0] ?? null, eficienciaMjKm: mj };
}

function inferCombustivel(specBlock: string, consumoBlock: string): string | null {
  const t = `${specBlock} ${consumoBlock}`.toLowerCase();
  if (t.includes('elétrico') || t.includes('eletrico')) return 'Eletrico';
  if (t.includes('plug-in') || t.includes('phev')) return 'Plug-in Hibrido';
  if (t.includes('híbrido') || t.includes('hibrido')) return 'Hibrido';
  if (t.includes('diesel')) return 'Diesel';
  if (t.includes('flex') || parseConsumoBlock(consumoBlock).consumoCidadeEtanol) return 'Flex';
  if (t.includes('gasolina') || t.includes('combustão')) return 'Gasolina';
  return null;
}

function extractMarcaModelo(text: string, marcas: string[]): { categoria: string | null; marca: string | null; resto: string } {
  let categoria: string | null = null;
  let work = text;
  for (const cat of CATEGORIAS) {
    if (work.includes(cat)) {
      categoria = cat;
      work = work.replace(cat, ' ').trim();
      break;
    }
  }
  for (const marca of marcas) {
    const idx = marcaAtWordBoundary(work, marca);
    if (idx >= 0) {
      const resto = work.slice(idx + marca.length).trim();
      return { categoria, marca: canonicalMarca(marca), resto };
    }
  }
  return { categoria, marca: null, resto: work };
}

function splitIdBlocks(idCol: string): string[] {
  if (!idCol.includes('/')) return [idCol.trim()];
  return idCol.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean);
}


function cleanVersao(raw: string): string {
  return raw.split(/\b(Combust[aã]o|El[eé]trico|H[ií]brido|Plug-in|M-\d|CVT|DCT|A-\d)\b/i)[0].trim();
}

function parseTableLine(line: string, marcas: string[], edicaoId: string, anoRef: number): PbevRawRecord[] {
  if (!line.includes('|')) return [];
  const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return [];
  if (parts[0].includes('Categoria Marca') || parts[0].includes('---')) return [];

  const specBlock = parts[1] ?? '';
  const consumoBlock = parts[2] ?? '';
  const classBlock = parts[3] ?? parts[2] ?? '';
  const consumo = parseConsumoBlock(consumoBlock);
  const cls = parseClassificacao(classBlock);
  const combustivel = inferCombustivel(specBlock, consumoBlock);
  const out: PbevRawRecord[] = [];

  for (const block of splitIdBlocks(parts[0])) {
    const { categoria, marca, resto } = extractMarcaModelo(block, marcas);
    if (!marca) continue;
    const tokens = resto.split(/\s+/);
    const modelo = tokens.slice(0, 2).join(' ') || resto;
    const versao = tokens.slice(2).join(' ') || resto.replace(modelo, '').trim() || modelo;
    out.push({
      edicaoId,
      anoReferencia: anoRef,
      categoria,
      marca,
      modelo: modelo.trim(),
      versao: cleanVersao(versao.trim() || modelo.trim()),
      combustivel,
      ...consumo,
      ...cls,
      linhaBruta: line.slice(0, 300),
    });
  }
  return out;
}

function findConsumoBlock(line: string): { block: string; start: number } | null {
  // Flex: 4 valores (G city, G hwy, E city, E hwy)
  const flex = line.match(/(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)/);
  if (flex) return { block: flex[0], start: flex.index ?? 0 };
  // Eletrico/hibrido: 2-3 valores km/kWh ou km/l
  const two = line.match(/(\d+[.,]\d+)\s+(\d+[.,]\d+)(?:\s+(\d+[.,]\d+))?/);
  if (two) return { block: two[0], start: two.index ?? 0 };
  return null;
}

function parsePlainLine(line: string, marcas: string[], edicaoId: string, anoRef: number): PbevRawRecord[] {
  const consumoHit = findConsumoBlock(line);
  if (!consumoHit) return [];
  const left = line.slice(0, consumoHit.start);
  const { categoria, marca, resto } = extractMarcaModelo(left, marcas);
  if (!marca) return [];

  const nums = consumoHit.block.split(/\s+/).map(parseNum).filter((n): n is number => n !== null);
  const consumo = {
    consumoCidadeGasolina: nums[0] ?? null,
    consumoEstradaGasolina: nums[1] ?? null,
    consumoCidadeEtanol: nums[2] ?? null,
    consumoEstradaEtanol: nums[3] ?? null,
  };
  const cls = parseClassificacao(line.slice(consumoHit.start));
  const tokens = resto.split(/\s+/);
  const modelo = tokens.slice(0, 2).join(' ') || resto;
  const versao = cleanVersao(tokens.slice(2).join(' ') || resto);

  return [{
    edicaoId,
    anoReferencia: anoRef,
    categoria,
    marca,
    modelo: modelo.trim(),
    versao: versao.trim() || modelo.trim(),
    combustivel: inferCombustivel(resto, consumoHit.block),
    ...consumo,
    ...cls,
    linhaBruta: line.slice(0, 300),
  }];
}

export async function extractPdf(file: string, edicaoId: string, anoRef: number): Promise<PbevRawRecord[]> {
  const buf = fs.readFileSync(file);
  const parser = new PDFParse({ data: buf });
  const parsed = await parser.getText();
  await parser.destroy();
  const marcas = loadMarcas();
  const lines = parsed.text.split(/\r?\n/);
  const records: PbevRawRecord[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 20) continue;
    if (trimmed.includes('|')) records.push(...parseTableLine(trimmed, marcas, edicaoId, anoRef));
    else records.push(...parsePlainLine(trimmed, marcas, edicaoId, anoRef));
  }
  return records;
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(PATHS.inmetroPbevCatalog, 'utf-8')) as { edicoes: { id: string; arquivo: string; ano?: number }[] };
  const pdfDir = path.join(PATHS.rawInmetro, 'pdfs');
  const target = process.argv.includes('--file')
    ? [process.argv[process.argv.indexOf('--file') + 1]]
    : fs.existsSync(pdfDir) ? fs.readdirSync(pdfDir).filter((f) => f.endsWith('.pdf')) : [];

  const all: PbevRawRecord[] = [];
  for (const file of target) {
    const full = path.isAbsolute(file) ? file : path.join(pdfDir, file);
    if (!fs.existsSync(full)) { console.warn('PDF ausente:', full); continue; }
    const ed = catalog.edicoes.find((e) => e.arquivo === path.basename(full));
    const edicaoId = ed?.id ?? path.basename(full, '.pdf');
    const anoRef = ed?.ano ?? new Date().getFullYear();
    console.log('Extraindo', path.basename(full), '...');
    const rows = await extractPdf(full, edicaoId, anoRef);
    console.log('  registros brutos:', rows.length);
    all.push(...rows);
  }

  const dedup = new Map<string, PbevRawRecord>();
  for (const r of all) {
    const key = `${marcaSlug(r.marca)}|${r.modelo.toLowerCase()}|${r.versao.toLowerCase()}|${r.edicaoId}`;
    if (!dedup.has(key)) dedup.set(key, r);
  }
  const records = [...dedup.values()];

  fs.mkdirSync(PATHS.rawInmetro, { recursive: true });
  fs.writeFileSync(path.join(PATHS.rawInmetro, 'pbev-extracted.json'), JSON.stringify(records, null, 2));
  console.log(JSON.stringify({ total: records.length, marcas: new Set(records.map((r) => r.marca)).size }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });