import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';

function readJson<T>(f: string, fb: T): T { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : fb; }

async function main() {
  const coverage = readJson(PATHS.dataCoverageReport, null);
  const enrichment = readJson(PATHS.coverageEnrichmentReport, null);
  const erros: string[] = [];
  if (!fs.existsSync(PATHS.srcVeiculos)) erros.push('FIPE ausente');
  const pdfs = fs.existsSync(path.join(PATHS.rawInmetro, 'pdfs')) ? fs.readdirSync(path.join(PATHS.rawInmetro, 'pdfs')).filter(f => f.endsWith('.pdf')).length : 0;
  const dashboard = { geradoEm: new Date().toISOString(), veiculosTotais: enrichment?.catalogoFipe?.total ?? 0, coberturaPorCampo: coverage?.coberturaPorCampo ?? null, fontes: { fipe: 'ok', inmetro: { pdfs }, fabricantes: 'pendente', ncap: fs.existsSync(PATHS.normalizedSafety) ? 'ok' : 'pendente', recalls: fs.existsSync(PATHS.normalizedRecalls) ? 'ok' : 'pendente' }, erros, saude: erros.length ? 'atencao' : 'saudavel' };
  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.dashboardSummary, JSON.stringify(dashboard, null, 2));
  console.log(JSON.stringify(dashboard, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });