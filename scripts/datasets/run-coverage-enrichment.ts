/**
 * Mede cobertura de enriquecimento real contra catalogo FIPE (50.395 veiculos).
 * Gera: data/reports/coverage-enrichment.json + field-quality-report.json
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { manufacturerMatchKey, normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import { buildInmetroMatchIndex, matchInmetroForVehicle } from '../lib/enrichment/inmetro-match.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

interface FieldStat {
  campo: string;
  origem: string;
  preenchidos: number;
  total: number;
  taxaPct: number;
  confiabilidade: 'alta' | 'media' | 'baixa';
}

function loadVehicles(): NormalizedVehicle[] {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return raw.map((v: NormalizedVehicle) => (v.vehicleId ? v : normalizeVehicle(v)));
}

function loadInmetroIndex() {
  const file = PATHS.normalizedInmetroRecords;
  if (!fs.existsSync(file)) return buildInmetroMatchIndex([]);
  return buildInmetroMatchIndex(JSON.parse(fs.readFileSync(file, 'utf-8')));
}

function loadManufacturerIndex(): Map<string, unknown> {
  const idx = new Map<string, unknown>();
  const dir = PATHS.rawManufacturers;
  if (!fs.existsSync(dir)) return idx;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as { marca: string; modelo: string; ano?: number }[]) {
      idx.set(manufacturerMatchKey(r.marca, r.modelo, r.ano ?? 0), r);
    }
  }
  return idx;
}

function hasHistory(id: string): boolean {
  return fs.existsSync(path.join(PATHS.historyRoot, `${id}.json`));
}

function loadStaticCatalog(): Map<string, { specs?: { cilindrada?: { valor?: number }; cambio?: string; consumo?: unknown } }> {
  const idx = new Map<string, { specs?: { cilindrada?: { valor?: number }; cambio?: string; consumo?: unknown } }>();
  if (!fs.existsSync(PATHS.staticSpecsCatalog)) return idx;
  const catalog = JSON.parse(fs.readFileSync(PATHS.staticSpecsCatalog, 'utf-8')) as Record<string, { specs?: { cilindrada?: { valor?: number }; cambio?: string; consumo?: unknown } }>;
  for (const [id, rec] of Object.entries(catalog)) idx.set(id, rec);
  return idx;
}

async function main() {
  const vehicles = loadVehicles();
  const inmetroIdx = loadInmetroIndex();
  const mfrIdx = loadManufacturerIndex();
  const staticIdx = loadStaticCatalog();

  let comFipe = 0;
  let comHistorico = 0;
  let comInmetro = 0;
  let comManufacturer = 0;
  let comNovosCampos = 0;
  let comStatic = 0;
  let comCilindrada = 0;
  let comCambio = 0;

  const porTipo = { carros: { total: 0, inmetro: 0 }, motos: { total: 0, inmetro: 0 }, caminhoes: { total: 0, inmetro: 0 } };
  const porMarcaTop = new Map<string, { total: number; inmetro: number; manufacturer: number }>();

  for (const v of vehicles) {
    comFipe++;
    const hist = hasHistory(v.vehicleId ?? v.id);
    if (hist) comHistorico++;

    const inmetroHit = !!matchInmetroForVehicle(v.marca, v.modelo, inmetroIdx);
    if (inmetroHit) comInmetro++;

    const mfrHit = mfrIdx.has(manufacturerMatchKey(v.marca, v.modelo, v.ano));
    if (mfrHit) comManufacturer++;

    if (inmetroHit || mfrHit) comNovosCampos++;

    const st = staticIdx.get(v.vehicleId ?? v.id);
    if (st) {
      comStatic++;
      if (st.specs?.cilindrada?.valor) comCilindrada++;
      if (st.specs?.cambio) comCambio++;
    }

    const tipo = v.tipo in porTipo ? v.tipo : 'carros';
    porTipo[tipo as keyof typeof porTipo].total++;
    if (inmetroHit) porTipo[tipo as keyof typeof porTipo].inmetro++;

    const ms = v.marca.toUpperCase();
    const bm = porMarcaTop.get(ms) ?? { total: 0, inmetro: 0, manufacturer: 0 };
    bm.total++;
    if (inmetroHit) bm.inmetro++;
    if (mfrHit) bm.manufacturer++;
    porMarcaTop.set(ms, bm);
  }

  const total = vehicles.length;
  const pct = (n: number) => Math.round((n / total) * 10000) / 100;

  const fields: FieldStat[] = [
    { campo: 'valor_fipe', origem: 'FIPE', preenchidos: comFipe, total, taxaPct: 100, confiabilidade: 'alta' },
    { campo: 'historico_precos', origem: 'FIPE/fipeX', preenchidos: comHistorico, total, taxaPct: pct(comHistorico), confiabilidade: 'alta' },
    { campo: 'consumo_cidade', origem: 'INMETRO/PBEV', preenchidos: comInmetro, total, taxaPct: pct(comInmetro), confiabilidade: 'alta' },
    { campo: 'consumo_estrada', origem: 'INMETRO/PBEV', preenchidos: comInmetro, total, taxaPct: pct(comInmetro), confiabilidade: 'alta' },
    { campo: 'classificacao_energetica', origem: 'INMETRO/PBEV', preenchidos: comInmetro, total, taxaPct: pct(comInmetro), confiabilidade: 'alta' },
    { campo: 'potencia_cv', origem: 'FABRICANTE', preenchidos: comManufacturer, total, taxaPct: pct(comManufacturer), confiabilidade: 'alta' },
    { campo: 'cilindrada_cc', origem: 'STATIC/FIPE+INMETRO', preenchidos: comCilindrada, total, taxaPct: pct(comCilindrada), confiabilidade: 'media' },
    { campo: 'cambio', origem: 'STATIC/FIPE+FABRICANTE', preenchidos: comCambio, total, taxaPct: pct(comCambio), confiabilidade: 'media' },
  ];

  const topMarcas = [...porMarcaTop.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([marca, s]) => ({
      marca,
      total: s.total,
      inmetroPct: s.total ? Math.round((s.inmetro / s.total) * 10000) / 100 : 0,
      manufacturerPct: s.total ? Math.round((s.manufacturer / s.total) * 10000) / 100 : 0,
    }));

  const report = {
    geradoEm: new Date().toISOString(),
    catalogoFipe: { total: comFipe, pct: 100 },
    cobertura: {
      fipe: { veiculos: comFipe, pct: 100 },
      historico: { veiculos: comHistorico, pct: pct(comHistorico) },
      inmetro: { veiculos: comInmetro, pct: pct(comInmetro), registrosFonte: fs.existsSync(PATHS.normalizedInmetroRecords) ? JSON.parse(fs.readFileSync(PATHS.normalizedInmetroRecords,"utf-8")).length : 0 },
      fabricantes: { veiculos: comManufacturer, pct: pct(comManufacturer), registrosFonte: mfrIdx.size },
      combinada: { veiculos: comNovosCampos, pct: pct(comNovosCampos), descricao: 'INMETRO e/ou fabricante (campos novos alem de FIPE/historico)' },
      staticSpecs: { veiculos: comStatic, pct: pct(comStatic), registrosFonte: staticIdx.size },
      cilindrada: { veiculos: comCilindrada, pct: pct(comCilindrada) },
      cambio: { veiculos: comCambio, pct: pct(comCambio) },
    },
    porTipo: {
      carros: { ...porTipo.carros, inmetroPct: porTipo.carros.total ? pct(porTipo.carros.inmetro) : 0 },
      motos: { ...porTipo.motos, inmetroPct: porTipo.motos.total ? pct(porTipo.motos.inmetro) : 0 },
      caminhoes: { ...porTipo.caminhoes, inmetroPct: porTipo.caminhoes.total ? pct(porTipo.caminhoes.inmetro) : 0 },
    },
    topMarcas,
    estimativaEnriquecimentoReal: {
      somenteHistorico: pct(comHistorico),
      novosCamposInmetro: pct(comInmetro),
      novosCamposFabricante: pct(comManufacturer),
      novosCamposCombinados: pct(comNovosCampos),
      staticSpecsCatalogo: pct(comStatic),
      cilindradaInferida: pct(comCilindrada),
      cambioInferido: pct(comCambio),
      carrosComInmetro: porTipo.carros.total ? pct(porTipo.carros.inmetro) : 0,
      observacao: 'PBEV cobre veiculos leves novos (~760-1600 versoes/ano). FIPE inclui motos, caminhoes e veiculos antigos sem PBEV.',
    },
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.coverageEnrichmentReport, JSON.stringify(report, null, 2));
  fs.writeFileSync(PATHS.fieldQualityReport, JSON.stringify({ geradoEm: report.geradoEm, campos: fields }, null, 2));

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });