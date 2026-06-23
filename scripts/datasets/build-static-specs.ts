/**
 * Constroi catalogo estatico de specs para todos os veiculos FIPE.
 * Fontes: INMETRO PBEV + fabricantes + inferencia FIPE (modelo).
 */
import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';
import { normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import { buildInmetroMatchIndex, matchInmetroForVehicle } from '../lib/enrichment/inmetro-match.js';
import { manufacturerMatchKey } from '../lib/enrichment/matching-engine.js';
import { inferSpecsFromFipeModel } from '../lib/enrichment/infer-fipe-specs.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

const PIPELINE_VERSION = 1;

interface ManufacturerRecord {
  marca: string;
  modelo: string;
  ano?: number;
  potenciaCv?: number;
  torqueNm?: number;
  cilindradaCc?: number;
  cambio?: string;
  pesoKg?: number;
  portaMalasL?: number;
  tanqueL?: number;
  fonte?: string;
}

type InmetroRow = {
  marca: string;
  modelo: string;
  versao?: string;
  consumoCidade?: number;
  consumoEstrada?: number;
  consumoCidadeEtanol?: number;
  consumoEstradaEtanol?: number;
  classificacaoEnergetica?: string;
};

function loadManufacturers(): Map<string, ManufacturerRecord> {
  const idx = new Map<string, ManufacturerRecord>();
  const dir = PATHS.rawManufacturers;
  if (!fs.existsSync(dir)) return idx;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'crawl-log.json')) {
    const parsed = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf-8'));
    const rows = Array.isArray(parsed) ? parsed : [];
    for (const r of rows as ManufacturerRecord[]) {
      idx.set(manufacturerMatchKey(r.marca, r.modelo, r.ano ?? 0), r);
    }
  }
  return idx;
}

function buildRecord(v: NormalizedVehicle, inmetro: InmetroRow | null, mfr: ManufacturerRecord | null) {
  const inferred = inferSpecsFromFipeModel(v.modelo);
  const flex = v.combustivel.toLowerCase().includes('flex');
  const sources = new Set<string>();
  const attrs: { source: string; field: string; confidence: string }[] = [];

  const add = (source: string, field: string, confidence: string) => {
    sources.add(source);
    attrs.push({ source, field, confidence });
  };

  const potencia = mfr?.potenciaCv ?? inferred.potenciaCv;
  const torque = mfr?.torqueNm ?? inferred.torqueNm;
  const cilindrada = mfr?.cilindradaCc ?? inferred.cilindradaCc;
  const cambio = mfr?.cambio ?? inferred.cambio;

  if (mfr?.potenciaCv) add('FABRICANTE', 'potencia', 'high');
  else if (inferred.potenciaCv) add('FIPE', 'potencia', 'medium');
  if (mfr?.torqueNm) add('FABRICANTE', 'torque', 'high');
  else if (inferred.torqueNm) add('FIPE', 'torque', 'low');
  if (mfr?.cilindradaCc) add('FABRICANTE', 'cilindrada', 'high');
  else if (inferred.cilindradaCc) add('FIPE', 'cilindrada', 'medium');
  if (mfr?.cambio) add('FABRICANTE', 'cambio', 'high');
  else if (inferred.cambio) add('FIPE', 'cambio', 'medium');

  const consumo = inmetro
    ? {
        cidadeG: inmetro.consumoCidade ?? null,
        cidadeE: flex ? (inmetro.consumoCidadeEtanol ?? null) : null,
        estradaG: inmetro.consumoEstrada ?? null,
        estradaE: flex ? (inmetro.consumoEstradaEtanol ?? null) : null,
        unidade: 'km/l' as const,
        fonte: 'INMETRO/PBEV',
      }
    : null;
  if (consumo) add('INMETRO', 'consumo', 'high');

  const classificacao = inmetro?.classificacaoEnergetica ?? null;
  if (classificacao) add('INMETRO', 'classificacaoEnergetica', 'high');

  add('FIPE', 'combustivel', 'high');

  return {
    vehicleId: v.vehicleId ?? v.id,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    specs: {
      potencia: potencia != null ? { valor: potencia, unidade: 'cv', fonte: mfr?.fonte ?? (inferred.potenciaCv ? 'FIPE' : 'FABRICANTE') } : undefined,
      torque: torque != null ? { valor: torque, unidade: 'Nm', fonte: mfr?.fonte ?? (inferred.torqueNm ? 'FIPE' : 'FABRICANTE') } : undefined,
      cilindrada: cilindrada != null ? { valor: cilindrada, unidade: 'cc' } : undefined,
      cambio: cambio ?? undefined,
      numPortas: inferred.numPortas ?? undefined,
      consumo: consumo ?? undefined,
      classificacaoEnergetica: classificacao ?? undefined,
      peso: mfr?.pesoKg != null ? { valor: mfr.pesoKg, unidade: 'kg' } : undefined,
      portaMalas: mfr?.portaMalasL != null ? { valor: mfr.portaMalasL, unidade: 'L' } : undefined,
      tanque: mfr?.tanqueL != null ? { valor: mfr.tanqueL, unidade: 'L' } : undefined,
      combustivel: v.combustivel,
      tipo: v.tipo,
      turbo: inferred.turbo || undefined,
      valvulas: inferred.valvulas ?? undefined,
    },
    attributions: attrs,
    metadata: {
      capturedAt: new Date().toISOString(),
      pipelineVersion: PIPELINE_VERSION,
      sources: [...sources],
    },
  };
}

async function main() {
  const input = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const raw = JSON.parse(fs.readFileSync(input, 'utf-8')) as NormalizedVehicle[];
  const vehicles = raw.map((v) => (v.vehicleId ? v : normalizeVehicle(v)));

  const inmetroRows = fs.existsSync(PATHS.normalizedInmetroRecords)
    ? (JSON.parse(fs.readFileSync(PATHS.normalizedInmetroRecords, 'utf-8')) as InmetroRow[])
    : [];
  const inmetroIdx = buildInmetroMatchIndex(inmetroRows);
  const mfrIdx = loadManufacturers();

  const catalog: Record<string, ReturnType<typeof buildRecord>> = {};
  let comInmetro = 0;
  let comFabricante = 0;
  let comInferido = 0;
  let comQualquer = 0;

  for (const v of vehicles) {
    const inmetro = matchInmetroForVehicle(v.marca, v.modelo, inmetroIdx) as InmetroRow | null;
    const mfr = mfrIdx.get(manufacturerMatchKey(v.marca, v.modelo, v.ano)) ?? null;
    const rec = buildRecord(v, inmetro, mfr);
    catalog[v.vehicleId ?? v.id] = rec;
    comQualquer++;
    if (inmetro) comInmetro++;
    if (mfr) comFabricante++;
    if (rec.attributions.some((a) => a.source === 'FIPE')) comInferido++;
  }

  fs.mkdirSync(PATHS.staticSpecs, { recursive: true });
  fs.writeFileSync(PATHS.staticSpecsCatalog, JSON.stringify(catalog));

  const manifest = {
    geradoEm: new Date().toISOString(),
    camada: 'permanente',
    totalVeiculos: vehicles.length,
    comSpecs: comQualquer,
    coberturaPct: Math.round((comQualquer / vehicles.length) * 10000) / 100,
    comInmetro,
    comFabricante,
    comInferidoFipe: comInferido,
    inmetroPct: Math.round((comInmetro / vehicles.length) * 10000) / 100,
    arquivo: 'catalog.json',
    pipelineVersion: PIPELINE_VERSION,
  };
  fs.writeFileSync(PATHS.staticSpecsManifest, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });