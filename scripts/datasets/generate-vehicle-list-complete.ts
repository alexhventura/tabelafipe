/**
 * Gera indice compacto da lista veicular completa (FIPE + specs + flags de enriquecimento).
 */
import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';

type StaticEntry = {
  vehicleId: string;
  marca: string;
  modelo: string;
  ano: number;
  specs: {
    cilindrada?: { valor: number };
    cambio?: string;
    consumo?: { cidadeG: number | null; estradaG: number | null; fonte: string };
    classificacaoEnergetica?: string;
    combustivel?: string;
    tipo?: string;
    potencia?: { valor: number };
    numPortas?: number;
    turbo?: boolean;
  };
  metadata: { sources: string[] };
};

type FipeVehicle = {
  id: string;
  slug: string;
  tipo: string;
  marca: string;
  modelo: string;
  ano: number;
  combustivel: string;
  valor: number;
  fipeCodigo: string;
  mesReferencia: string;
};

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

async function main() {
  const veiculos = readJson<FipeVehicle[]>(PATHS.srcVeiculos, []);
  const catalog = readJson<Record<string, StaticEntry>>(PATHS.staticSpecsCatalog, {});
  const coverage = readJson<{ cobertura?: Record<string, { veiculos: number; pct: number }> }>(PATHS.coverageEnrichmentReport, {});

  const lista = veiculos.map((v) => {
    const id = v.slug ?? v.id;
    const spec = catalog[id];
    const s = spec?.specs;
    return {
      id,
      slug: id,
      tipo: v.tipo,
      marca: v.marca,
      modelo: v.modelo,
      ano: v.ano,
      combustivel: v.combustivel,
      valor: v.valor,
      fipeCodigo: v.fipeCodigo,
      mesReferencia: v.mesReferencia,
      specs: s
        ? {
            cilindradaCc: s.cilindrada?.valor ?? null,
            cambio: s.cambio ?? null,
            potenciaCv: s.potencia?.valor ?? null,
            numPortas: s.numPortas ?? null,
            turbo: s.turbo ?? false,
            consumoCidade: s.consumo?.cidadeG ?? null,
            consumoEstrada: s.consumo?.estradaG ?? null,
            classificacaoEnergetica: s.classificacaoEnergetica ?? null,
          }
        : null,
      fontes: spec?.metadata?.sources ?? ['FIPE'],
      temInmetro: Boolean(s?.consumo?.cidadeG),
      temSpecs: Boolean(s?.cilindrada?.valor || s?.cambio),
    };
  });

  fs.mkdirSync(PATHS.indexesRoot, { recursive: true });
  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.vehicleListComplete, JSON.stringify({ geradoEm: new Date().toISOString(), total: lista.length, veiculos: lista }));

  const summary = {
    geradoEm: new Date().toISOString(),
    total: lista.length,
    comInmetro: lista.filter((x) => x.temInmetro).length,
    comSpecs: lista.filter((x) => x.temSpecs).length,
    comCambio: lista.filter((x) => x.specs?.cambio).length,
    comCilindrada: lista.filter((x) => x.specs?.cilindradaCc).length,
    porTipo: ['carros', 'motos', 'caminhoes'].map((tipo) => {
      const subset = lista.filter((x) => x.tipo === tipo);
      return {
        tipo,
        total: subset.length,
        comInmetro: subset.filter((x) => x.temInmetro).length,
        comSpecs: subset.filter((x) => x.temSpecs).length,
      };
    }),
    coberturaRelatorio: coverage.cobertura ?? null,
    arquivoIndice: 'data/indexes/vehicle-list-complete.json',
  };

  fs.writeFileSync(PATHS.vehicleListCompleteSummary, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });