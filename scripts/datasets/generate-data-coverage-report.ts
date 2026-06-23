import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { ALL_DATA_FIELDS } from '../lib/data-architecture.js';
import { normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

type StaticRec = { specs?: { potencia?: { valor?: number }; torque?: { valor?: number }; cilindrada?: { valor?: number }; cambio?: string; peso?: { valor?: number }; portaMalas?: { valor?: number }; tanque?: { valor?: number }; consumo?: { cidadeG?: number }; classificacaoEnergetica?: string } };

function loadVehicles(): NormalizedVehicle[] {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  return JSON.parse(fs.readFileSync(file, 'utf-8')).map((v: NormalizedVehicle) => (v.vehicleId ? v : normalizeVehicle(v)));
}

function loadStatic(): Map<string, StaticRec> {
  const m = new Map<string, StaticRec>();
  if (!fs.existsSync(PATHS.staticSpecsCatalog)) return m;
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(PATHS.staticSpecsCatalog, 'utf-8')) as Record<string, StaticRec>)) m.set(k, v);
  return m;
}

async function main() {
  const vehicles = loadVehicles();
  const total = vehicles.length;
  const staticCat = loadStatic();
  const pct = (n: number) => Math.round((n / total) * 10000) / 100;
  const count = (fn: (v: NormalizedVehicle, s?: StaticRec) => boolean) => vehicles.filter(v => fn(v, staticCat.get(v.vehicleId))).length;
  const campos = [
    { campo: 'valor_fipe', preenchidos: total, meta: 100 },
    { campo: 'historico_precos', preenchidos: count(v => fs.existsSync(path.join(PATHS.historyRoot, v.vehicleId + '.json'))), meta: 100 },
    { campo: 'consumo_urbano', preenchidos: count((_, s) => !!s?.specs?.consumo?.cidadeG), meta: 70 },
    { campo: 'potencia_cv', preenchidos: count((_, s) => !!s?.specs?.potencia?.valor), meta: 70 },
    { campo: 'torque_nm', preenchidos: count((_, s) => !!s?.specs?.torque?.valor), meta: 70 },
    { campo: 'cilindrada_cc', preenchidos: count((_, s) => !!s?.specs?.cilindrada?.valor), meta: 95 },
    { campo: 'transmissao', preenchidos: count((_, s) => !!s?.specs?.cambio), meta: 70 },
    { campo: 'porta_malas_l', preenchidos: count((_, s) => !!s?.specs?.portaMalas?.valor), meta: 50 },
    { campo: 'seguranca_ncap', preenchidos: 0, meta: 40 },
    { campo: 'recalls', preenchidos: 0, meta: 40 },
    { campo: 'garantia', preenchidos: 0, meta: 30 },
  ].map(c => ({ ...c, total, pct: pct(c.preenchidos), gap: Math.max(0, c.meta - pct(c.preenchidos)) }));
  const report = {
    geradoEm: new Date().toISOString(),
    catalogo: { total, porCategoria: { carros: vehicles.filter(v => v.tipo === 'carros').length, motos: vehicles.filter(v => v.tipo === 'motos').length, caminhoes: vehicles.filter(v => v.tipo === 'caminhoes').length } },
    fontesAtuais: { fipe: true, inmetro: fs.existsSync(PATHS.normalizedInmetroRecords), fabricantes: fs.existsSync(PATHS.rawManufacturers), latinNcap: fs.existsSync(PATHS.normalizedSafety), recalls: fs.existsSync(PATHS.normalizedRecalls) },
    fontesPotenciais: ['fabricantes', 'latin-ncap', 'senatran-recalls', 'garantia-fabricante', 'manuais-proprietario'],
    coberturaPorCampo: campos,
    camposFaltantes: campos.filter(c => c.pct < c.meta).sort((a, b) => b.gap - a.gap),
    metasFinais: { catalogoFipe: 100, historico: 100, specsTecnicas: 95, consumoOficial: 70, transmissao: 70, potencia: 70, torque: 70, indicesBusca: 100 },
    roadmapCampos: ALL_DATA_FIELDS.map(f => ({ id: f.id, label: f.label, metaPct: f.metaCoberturaPct })),
  };
  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.dataCoverageReport, JSON.stringify(report, null, 2));
  const md = ['# Relatorio de Cobertura de Dados', '', 'Total: ' + total, '', '| Campo | % | Meta | Gap |', '|-------|---|------|-----|', ...campos.map(c => '| ' + c.campo + ' | ' + c.pct + '% | ' + c.meta + '% | ' + c.gap + '% |')].join('\n');
  fs.writeFileSync(PATHS.dataCoverageReportMd, md);
  console.log(JSON.stringify({ output: PATHS.dataCoverageReport, total }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });