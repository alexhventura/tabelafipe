import fs from 'fs';
import path from 'path';
import { PATHS } from '../../../lib/fipe-paths.js';

export interface MfrSpecRecord {
  marca: string;
  modelo: string;
  ano?: number;
  potenciaCv?: number;
  torqueNm?: number;
  cambio?: string;
  portaMalasL?: number;
  tanqueL?: number;
  fonte: string;
  urlFonte?: string;
  capturadoEm: string;
}

export interface ModelPageTarget {
  url: string;
  modelo: string;
  ano?: number;
}

function kgfmToNm(kgfm: number): number {
  return Math.round(kgfm * 9.80665);
}

/** Extrai specs de texto/HTML de pagina de modelo OEM. */
export function parseModelPage(
  html: string,
  marca: string,
  modelo: string,
  fonte: string,
  ano?: number,
): MfrSpecRecord | null {
  const now = new Date().toISOString();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  let potenciaCv: number | undefined;
  const pot = text.match(/pot[êe]ncia[^0-9]{0,80}(\d{2,4})\s*(?:cv|hp)/i);
  if (pot) potenciaCv = parseInt(pot[1], 10);
  if (!potenciaCv) {
    const ate = text.match(/pot[êe]ncia\s*at[ée][^0-9]{0,20}(\d{2,4})\s*(?:cv|hp)/i);
    if (ate) potenciaCv = parseInt(ate[1], 10);
  }
  if (!potenciaCv) {
    const alt = text.match(/(\d{2,4})\s*(?:cv|hp)/i);
    if (alt) potenciaCv = parseInt(alt[1], 10);
  }

  let torqueNm: number | undefined;
  const torNm = text.match(/(\d{1,3}[.,]\d|\d{2,4})\s*n\.?m\b/i);
  if (torNm) torqueNm = Math.round(parseFloat(String(torNm[1]).replace(',', '.')));
  if (!torqueNm) {
    const torKgf = text.match(/(\d{1,2}[.,]\d)\s*kgf\.?m/i);
    if (torKgf) torqueNm = kgfmToNm(parseFloat(torKgf[1].replace(',', '.')));
  }

  let cambio: string | undefined;
  if (/\bcvt\b/i.test(text)) cambio = 'CVT';
  else if (/\b(dsg|dct|automatiz)/i.test(text)) cambio = 'Automatizado';
  else if (/\b(manual|câmbio manual|mt\b)/i.test(text)) cambio = 'Manual';
  else if (/\b(autom[aá]tic|tiptronic|at\b)/i.test(text)) cambio = 'Automatico';

  const pm = text.match(/porta[\s-]?malas[^0-9]{0,40}(\d{2,4})\s*l/i);
  const tk = text.match(/tanque[^0-9]{0,40}(\d{2,3})\s*l/i);

  if (!potenciaCv && !torqueNm && !cambio && !pm && !tk) return null;

  return {
    marca,
    modelo,
    ano,
    potenciaCv,
    torqueNm,
    cambio,
    portaMalasL: pm ? parseInt(pm[1], 10) : undefined,
    tanqueL: tk ? parseInt(tk[1], 10) : undefined,
    fonte,
    capturadoEm: now,
  };
}

export async function fetchModelPages(
  slug: string,
  nome: string,
  pages: ModelPageTarget[],
): Promise<MfrSpecRecord[]> {
  const all: MfrSpecRecord[] = [];
  for (const page of pages) {
    try {
      const res = await fetch(page.url, {
        headers: { 'User-Agent': 'consulta-tabela-fipe/1.0 (dados-publicos)', 'Accept-Language': 'pt-BR,pt;q=0.9' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        console.warn(`[${slug}] ${res.status} ${page.url}`);
        continue;
      }
      const rec = parseModelPage(await res.text(), nome, page.modelo, page.url, page.ano);
      if (rec) all.push({ ...rec, urlFonte: page.url });
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.warn(`[${slug}] erro ${page.url}:`, e);
    }
  }
  const dest = path.join(PATHS.rawManufacturers, `${slug}.json`);
  if (all.length) fs.writeFileSync(dest, JSON.stringify(all, null, 2));
  return all;
}

/** Paginas oficiais de modelos (fichas publicas OEM Brasil). */
export const BRAND_MODEL_PAGES: Record<string, { nome: string; pages: ModelPageTarget[] }> = {
  toyota: {
    nome: 'Toyota',
    pages: [
      { url: 'https://www.toyota.com.br/modelos/corolla', modelo: 'Corolla', ano: 2026 },
      { url: 'https://www.toyota.com.br/modelos/corolla-hybrid', modelo: 'Corolla Hybrid', ano: 2026 },
      { url: 'https://www.toyota.com.br/modelos/corolla-cross', modelo: 'Corolla Cross', ano: 2026 },
      { url: 'https://www.toyota.com.br/modelos/hilux-cabine-dupla', modelo: 'Hilux', ano: 2026 },
      { url: 'https://www.toyota.com.br/modelos/sw4', modelo: 'SW4', ano: 2026 },
      { url: 'https://www.toyota.com.br/modelos/rav4', modelo: 'RAV4', ano: 2026 },
      { url: 'https://www.toyota.com.br/modelos/yaris-cross', modelo: 'Yaris Cross', ano: 2026 },
      { url: 'https://www.toyota.com.br/modelos/gr-corolla', modelo: 'GR Corolla', ano: 2026 },
    ],
  },
  volkswagen: {
    nome: 'VW - VolksWagen',
    pages: [
      { url: 'https://www.vw.com.br/pt/carros/polo.html', modelo: 'Polo', ano: 2026 },
      { url: 'https://www.vw.com.br/pt/carros/t-cross.html', modelo: 'T-Cross', ano: 2026 },
      { url: 'https://www.vw.com.br/pt/carros/virtus.html', modelo: 'Virtus', ano: 2026 },
      { url: 'https://www.vw.com.br/pt/carros/nivus.html', modelo: 'Nivus', ano: 2026 },
      { url: 'https://www.vw.com.br/pt/carros/taos.html', modelo: 'Taos', ano: 2026 },
      { url: 'https://www.vw.com.br/pt/carros/amarok.html', modelo: 'Amarok', ano: 2026 },
    ],
  },
  chevrolet: {
    nome: 'GM - Chevrolet',
    pages: [
      { url: 'https://www.chevrolet.com.br/carros/novo-onix', modelo: 'Onix', ano: 2027 },
      { url: 'https://www.chevrolet.com.br/suvs/novo-tracker', modelo: 'Tracker', ano: 2027 },
      { url: 'https://www.chevrolet.com.br/picapes/chevrolet-montana', modelo: 'Montana', ano: 2027 },
      { url: 'https://www.chevrolet.com.br/suvs/novo-spin', modelo: 'Spin', ano: 2027 },
      { url: 'https://www.chevrolet.com.br/suvs/equinox', modelo: 'Equinox', ano: 2026 },
    ],
  },
  fiat: {
    nome: 'Fiat',
    pages: [
      { url: 'https://argo.fiat.com.br/monte.html', modelo: 'Argo', ano: 2027 },
      { url: 'https://cronos.fiat.com.br/monte.html', modelo: 'Cronos', ano: 2027 },
      { url: 'https://pulse.fiat.com.br/monte.html', modelo: 'Pulse', ano: 2027 },
      { url: 'https://fastback.fiat.com.br/monte.html', modelo: 'Fastback', ano: 2027 },
      { url: 'https://toro.fiat.com.br/monte.html', modelo: 'Toro', ano: 2027 },
      { url: 'https://strada.fiat.com.br/monte.html', modelo: 'Strada', ano: 2027 },
    ],
  },
  honda: {
    nome: 'Honda',
    pages: [
      { url: 'https://www.honda.com.br/automoveis/civic', modelo: 'Civic', ano: 2026 },
      { url: 'https://www.honda.com.br/automoveis/city', modelo: 'City', ano: 2026 },
      { url: 'https://www.honda.com.br/automoveis/hr-v', modelo: 'HR-V', ano: 2026 },
      { url: 'https://www.honda.com.br/automoveis/cr-v', modelo: 'CR-V', ano: 2026 },
      { url: 'https://www.honda.com.br/automoveis/zr-v', modelo: 'ZR-V', ano: 2026 },
    ],
  },
  hyundai: {
    nome: 'Hyundai',
    pages: [
      { url: 'https://www.hyundai.com.br/veiculos/novo-hyundai-hb20', modelo: 'HB20', ano: 2026 },
      { url: 'https://www.hyundai.com.br/veiculos/creta', modelo: 'Creta', ano: 2026 },
      { url: 'https://www.hyundai.com.br/veiculos/tucson.html', modelo: 'Tucson', ano: 2025 },
    ],
  },
  jeep: {
    nome: 'Jeep',
    pages: [
      { url: 'https://www.jeep.com.br/compass.html', modelo: 'Compass', ano: 2026 },
      { url: 'https://www.jeep.com.br/renegade.html', modelo: 'Renegade', ano: 2026 },
      { url: 'https://www.jeep.com.br/commander.html', modelo: 'Commander', ano: 2026 },
    ],
  },
  nissan: {
    nome: 'Nissan',
    pages: [
      { url: 'https://www.nissan.com.br/veiculos/modelos/novo-kicks.html', modelo: 'Kicks', ano: 2026 },
      { url: 'https://www.nissan.com.br/veiculos/modelos/versa/versoes.html', modelo: 'Versa', ano: 2026 },
      { url: 'https://www.nissan.com.br/veiculos/modelos/frontier.html', modelo: 'Frontier', ano: 2026 },
    ],
  },
};

/** @deprecated use BRAND_MODEL_PAGES */
export const BRAND_SPEC_URLS: Record<string, string[]> = Object.fromEntries(
  Object.entries(BRAND_MODEL_PAGES).map(([k, v]) => [k, v.pages.map((p) => p.url)]),
);

export async function fetchBrandSpecs(slug: string, nome: string, urls: string[]) {
  const pages = urls.map((url) => ({
    url,
    modelo: url.split('/').filter(Boolean).pop()?.replace(/\.html$/, '') ?? 'modelo',
    ano: 2026,
  }));
  return fetchModelPages(slug, nome, pages);
}
