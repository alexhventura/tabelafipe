/** Extrai dados de manutencao de texto PDF (manuais e fichas tecnicas). */
export interface MaintenanceRecord {
  marca: string;
  modelo: string;
  ano?: number;
  oleoRecomendado?: string;
  capacidadeOleoL?: number;
  bateriaAh?: number;
  pneusMedida?: string;
  velas?: string;
  fluidoArrefecimento?: string;
  fluidoFreio?: string;
  fonte: string;
  capturadoEm: string;
}

export function parseMaintenanceText(text: string, marca: string, modelo: string, fonte: string, ano?: number): MaintenanceRecord | null {
  const t = text.replace(/\s+/g, " ");
  const now = new Date().toISOString();

  let oleoRecomendado: string | undefined;
  const oleo = t.match(/(?:oleo|lubrificante|lubricante)[^\n]{0,80}?(\d{1,2}[wW]\s*\d{2}|\d{1,2}[wW]\-\d{2}|sintetico|semissintetico)/i);
  if (oleo) oleoRecomendado = oleo[1];

  let capacidadeOleoL: number | undefined;
  const cap = t.match(/(?:capacidade|volume)[^0-9]{0,40}(?:oleo|lubrificante)[^0-9]{0,30}(\d{1,2}[.,]\d|\d{1,2})\s*l/i)
    ?? t.match(/(?:oleo|lubrificante)[^0-9]{0,40}(\d{1,2}[.,]\d|\d{1,2})\s*l/i);
  if (cap) capacidadeOleoL = parseFloat(cap[1].replace(",", "."));

  let bateriaAh: number | undefined;
  const bat = t.match(/bateria[^0-9]{0,40}(\d{2,3})\s*ah/i);
  if (bat) bateriaAh = parseInt(bat[1], 10);

  let pneusMedida: string | undefined;
  const pneu = t.match(/(\d{3}\/\d{2}\s*R\s*\d{2})/i);
  if (pneu) pneusMedida = pneu[1].replace(/\s+/g, "");

  let velas: string | undefined;
  const vela = t.match(/vela[^\n]{0,40}?(NGK[^\s,]+|Champion[^\s,]+|\d{1,2}\s*un)/i);
  if (vela) velas = vela[1];

  let fluidoArrefecimento: string | undefined;
  const arref = t.match(/(?:arrefecimento|refrigerante)[^\n]{0,60}?(\d{1,2}[.,]\d\s*l|org[aâ]nico|inorg[aâ]nico)/i);
  if (arref) fluidoArrefecimento = arref[1];

  let fluidoFreio: string | undefined;
  const freio = t.match(/(?:freio|fluido de freio)[^\n]{0,40}?(DOT\s*\d(?:\.\d)?)/i);
  if (freio) fluidoFreio = freio[1];

  if (!oleoRecomendado && !capacidadeOleoL && !bateriaAh && !pneusMedida) return null;

  return { marca, modelo, ano, oleoRecomendado, capacidadeOleoL, bateriaAh, pneusMedida, velas, fluidoArrefecimento, fluidoFreio, fonte, capturadoEm: now };
}
