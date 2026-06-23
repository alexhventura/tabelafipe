/**
 * Extrai specs de catalogos PDF oficiais OEM (Hyundai etc.).
 */
import { PDFParse } from 'pdf-parse';
import type { ManufacturerRecord } from '../../../lib/enrichment/manufacturer-record.js';
import type { PdfCatalogSeed } from './types.js';

function kgfmToNm(kgfm: number): number {
  return Math.round(kgfm * 9.80665);
}

function stripText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Parse ficha tecnica de texto PDF (padrao OEM Brasil). */
export function parsePdfSpecText(
  text: string,
  marca: string,
  modelo: string,
  fonte: string,
  ano?: number,
  versao?: string,
): ManufacturerRecord | null {
  const t = stripText(text);
  const now = new Date().toISOString();

  let potenciaCv: number | undefined;
  const pot = t.match(/pot[êe]ncia\s*m[aá]xima[^0-9]{0,40}(\d{2,4})\s*\((?:E|G)?\)?/i)
    ?? t.match(/(\d{2,4})\s*\(E\)\s*\|\s*(\d{2,4})\s*\(G\)/);
  if (pot) potenciaCv = parseInt(pot[1], 10);

  let torqueNm: number | undefined;
  const torKgf = t.match(/torque\s*m[aá]ximo[^0-9]{0,40}(\d{1,2}[.,]\d)\s*\((?:E|G)?\)?/i)
    ?? t.match(/(\d{1,2}[.,]\d)\s*\(E\)[^0-9]{0,30}(\d{1,2}[.,]\d)\s*\(G\)/i);
  if (torKgf) torqueNm = kgfmToNm(parseFloat(String(torKgf[1]).replace(',', '.')));

  let cambio: string | undefined;
  if (/\bcvt\b/i.test(t)) cambio = 'CVT';
  else if (/\b(dupla embreagem|dct|dsg|automatiz)/i.test(t)) cambio = 'Automatizado';
  else if (/\b(manual|mecan)/i.test(t)) cambio = 'Manual';
  else if (/\b(autom[aá]tic|sequencial|xtronic)/i.test(t)) cambio = 'Automatico';

  let cilindradaCc: number | undefined;
  const cc = t.match(/(\d\.\d)\s*L\b/i);
  if (cc) cilindradaCc = Math.round(parseFloat(cc[1]) * 1000);

  const pm = t.match(/porta[\s-]?malas[^0-9]{0,40}(\d{2,4})\s*l/i);
  const tk = t.match(/tanque[^0-9]{0,40}(\d{2,3})\s*l/i);
  const peso = t.match(/peso[^0-9]{0,40}(\d{3,4})\s*kg/i);
  const comp = t.match(/comprimento[^0-9]{0,40}(\d{4})\s*mm/i);
  const larg = t.match(/largura[^0-9]{0,40}(\d{4})\s*mm/i);
  const alt = t.match(/altura[^0-9]{0,40}(\d{3,4})\s*mm/i);
  const eix = t.match(/entre[\s-]?eixos[^0-9]{0,40}(\d{4})\s*mm/i);
  const a0 = t.match(/0\s*a\s*100[^0-9]{0,20}(\d{1,2}[.,]\d)/i);
  const vmax = t.match(/velocidade\s*m[aá]xima[^0-9]{0,30}(\d{3})\s*km/i);
  const bat = t.match(/bateria[^0-9]{0,40}(\d{1,3}[.,]?\d*)\s*kwh/i);
  const aut = t.match(/autonomia[^0-9]{0,40}(\d{2,4})\s*km/i);

  if (!potenciaCv && !torqueNm && !cambio && !pm && !tk && !cilindradaCc) return null;

  return {
    marca,
    modelo,
    versao,
    ano,
    potenciaCv,
    torqueNm,
    cambio,
    cilindradaCc,
    pesoKg: peso ? parseInt(peso[1], 10) : undefined,
    comprimentoMm: comp ? parseInt(comp[1], 10) : undefined,
    larguraMm: larg ? parseInt(larg[1], 10) : undefined,
    alturaMm: alt ? parseInt(alt[1], 10) : undefined,
    entreEixosMm: eix ? parseInt(eix[1], 10) : undefined,
    portaMalasL: pm ? parseInt(pm[1], 10) : undefined,
    tanqueL: tk ? parseInt(tk[1], 10) : undefined,
    aceleracao0a100: a0 ? parseFloat(a0[1].replace(',', '.')) : undefined,
    velocidadeMaxKmh: vmax ? parseInt(vmax[1], 10) : undefined,
    bateriaKwh: bat ? parseFloat(bat[1].replace(',', '.')) : undefined,
    autonomiaKm: aut ? parseInt(aut[1], 10) : undefined,
    fonte,
    urlFonte: fonte,
    capturadoEm: now,
  };
}

export async function fetchPdfCatalogs(
  marca: string,
  targets: PdfCatalogSeed[],
  adapterId: string,
): Promise<ManufacturerRecord[]> {
  const out: ManufacturerRecord[] = [];
  for (const target of targets) {
    try {
      const res = await fetch(target.url, {
        headers: { 'User-Agent': 'consulta-tabela-fipe/1.0 (dados-publicos)' },
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const parser = new PDFParse({ data: buf });
      const text = (await parser.getText()).text ?? '';
      await parser.destroy();
      const rec = parsePdfSpecText(text, marca, target.modelo, target.url, target.ano, target.versao);
      if (rec) {
        rec.adapterId = adapterId;
        rec.urlFonte = target.url;
        out.push(rec);
      }
    } catch {
      /* skip */
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return out;
}