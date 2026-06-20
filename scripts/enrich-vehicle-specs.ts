/**
 * Camada 3 - Enriquecedor de fichas tecnicas (INMETRO PBEV + heuristica).
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from './lib/fipe-paths.js';

export interface FichaTecnica {
  potenciaCv?: number;
  cilindradaCc?: number;
  consumo?: {
    cidadeGasolina?: number;
    estradaGasolina?: number;
    cidadeEtanol?: number;
    estradaEtanol?: number;
  };
  classificacaoEnergetica?: string;
  fonte?: string;
}

interface PbevRecord {
  marca: string;
  modelo: string;
  consumoCidade?: number;
  consumoEstrada?: number;
  classificacao?: string;
  potenciaCv?: number;
  cilindradaCc?: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (f: string, d: string) => {
    const i = args.indexOf(f);
    return i >= 0 && args[i + 1] ? args[i + 1] : d;
  };
  return {
    input: get('--input', PATHS.srcVeiculos),
    pbev: get('--pbev', path.join(PATHS.rawRoot, 'inmetro', 'pbev-latest.json')),
    output: get('--output', path.join(PATHS.normalizedRoot, 'veiculos-enriched.json')),
  };
}

function normKey(m: string, mod: string) {
  return `${m} ${mod}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadPbev(file: string): Map<string, PbevRecord> {
  const map = new Map<string, PbevRecord>();
  if (!fs.existsSync(file)) return map;
  for (const r of JSON.parse(fs.readFileSync(file, 'utf-8')) as PbevRecord[]) {
    map.set(normKey(r.marca, r.modelo), r);
  }
  return map;
}

function inferCat(marca: string, valor?: number): 'baixa' | 'media' | 'alta' {
  const x = marca.toLowerCase();
  if (['bmw', 'mercedes', 'audi', 'porsche'].some((p) => x.includes(p)) || (valor && valor > 150_000))
    return 'alta';
  if (['fiat', 'renault', 'chevrolet', 'vw', 'hyundai'].some((p) => x.includes(p)) || (valor && valor < 60_000))
    return 'baixa';
  return 'media';
}

function estConsumo(comb: string, cat: 'baixa' | 'media' | 'alta') {
  const b = cat === 'baixa' ? 13 : cat === 'alta' ? 9 : 11;
  const flex = comb.toLowerCase().includes('flex');
  return {
    cidadeGasolina: b,
    estradaGasolina: b + 2,
    cidadeEtanol: flex ? b * 0.7 : undefined,
    estradaEtanol: flex ? (b + 2) * 0.7 : undefined,
  };
}

async function main() {
  const { input, pbev, output } = parseArgs();
  if (!fs.existsSync(input)) {
    console.error('Nao encontrado:', input);
    process.exit(1);
  }

  const veiculos = JSON.parse(fs.readFileSync(input, 'utf-8')) as Record<string, unknown>[];
  const pbevIdx = loadPbev(pbev);

  const out = veiculos.map((v) => {
    const marca = String(v.marca ?? '');
    const modelo = String(v.modelo ?? '');
    const p = pbevIdx.get(normKey(marca, modelo));
    const cat = inferCat(marca, typeof v.valor === 'number' ? v.valor : undefined);
    const ficha: FichaTecnica = p
      ? {
          fonte: 'inmetro-pbev',
          potenciaCv: p.potenciaCv,
          cilindradaCc: p.cilindradaCc,
          classificacaoEnergetica: p.classificacao,
          consumo: { cidadeGasolina: p.consumoCidade, estradaGasolina: p.consumoEstrada },
        }
      : { fonte: 'heuristica', consumo: estConsumo(String(v.combustivel ?? 'Flex'), cat) };
    return { id: String(v.id), categoriaPecas: cat, fichaTecnica: ficha };
  });

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(out));
  console.log(`Enriquecidos: ${out.length} | PBEV: ${out.filter((o) => o.fichaTecnica?.fonte === 'inmetro-pbev').length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
