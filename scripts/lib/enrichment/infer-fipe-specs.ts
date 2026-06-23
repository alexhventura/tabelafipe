/**
 * Infere specs tecnicas a partir do texto do modelo FIPE (heuristica, confiabilidade media).
 */
export interface InferredFipeSpecs {
  cilindradaCc: number | null;
  potenciaCv: number | null;
  torqueNm: number | null;
  cambio: string | null;
  numPortas: number | null;
  valvulas: number | null;
  turbo: boolean;
}

export function inferSpecsFromFipeModel(modelo: string): InferredFipeSpecs {
  const m = modelo.toUpperCase();
  let cilindradaCc: number | null = null;
  const cil = modelo.match(/\b(\d+[.,]\d+)\s*(?:16V|8V|12V|20V|V6|V8|TURBO|FLEX|GAS)?/i);
  if (cil) {
    const litros = parseFloat(cil[1].replace(',', '.'));
    if (litros > 0 && litros < 10) cilindradaCc = Math.round(litros * 1000);
  }
  if (!cilindradaCc) {
    const cc = modelo.match(/\b(\d{3,4})\s*CC\b/i);
    if (cc) cilindradaCc = parseInt(cc[1], 10);
  }
  if (!cilindradaCc) {
    const nums = modelo.match(/\b(\d{2,4})\b/g);
    if (nums) {
      const candidates = nums.map((n) => parseInt(n, 10)).filter((n) => n >= 50 && n <= 2000);
      if (candidates.length === 1) cilindradaCc = candidates[0];
      else if (candidates.length > 1) {
        const likely = candidates.find((n) => n >= 80 && n <= 800) ?? candidates[0];
        cilindradaCc = likely;
      }
    }
  }
  if (!cilindradaCc) {
    const lit = modelo.match(/\b(\d+[.,]\d+)-(?:\d+V|\d+)/i);
    if (lit) {
      const l = parseFloat(lit[1].replace(',', '.'));
      if (l > 0 && l < 10) cilindradaCc = Math.round(l * 1000);
    }
  }

  let cambio: string | null = null;
  if (/\b(MEC\.?|MANUAL|MT\b|SINC\.?|SINCRONIZ)\b/i.test(modelo)) cambio = 'Manual';
  else if (/\bCVT\b/i.test(modelo)) cambio = 'CVT';
  else if (/\b(DCT|DSG|PDK|AUTOMATIZ|TIPTRONIC|STEPTRONIC|POWERSHIFT|IMOTION|S[\s-]?TRONIC|EASYTRONIC|DUALOGIC)\b/i.test(modelo)) cambio = 'Automatizado';
  else if (/\b(AUT\.?|AUTOMAT|AUTOMATICO|EAT\b)\b/i.test(modelo)) cambio = 'Automatico';
  else if (/\bAT\b/i.test(modelo) && !/\bATV\b/i.test(modelo)) cambio = 'Automatico';

  let potenciaCv: number | null = null;
  const cv = modelo.match(/\b(\d{2,3})\s*(?:CV|HP)\b/i);
  if (cv) potenciaCv = parseInt(cv[1], 10);
  if (!potenciaCv) {
    const kw = modelo.match(/\b(\d{2,3})\s*KW\b/i);
    if (kw) potenciaCv = Math.round(parseInt(kw[1], 10) * 1.36);
  }

  let torqueNm: number | null = null;
  const tq = modelo.match(/\b(\d{2,4})\s*(?:KGFM|KGF\.M|NM)\b/i);
  if (tq) torqueNm = parseInt(tq[1], 10);

  const portas = modelo.match(/\b(\d)\s*P\b/i);
  const numPortas = portas ? parseInt(portas[1], 10) : null;

  const val = modelo.match(/\b(8|12|16|20|24|32)\s*V\b/i);
  const valvulas = val ? parseInt(val[1], 10) : null;

  return {
    cilindradaCc,
    potenciaCv,
    torqueNm,
    cambio,
    numPortas,
    valvulas,
    turbo: /\bTURBO\b/i.test(m),
  };
}