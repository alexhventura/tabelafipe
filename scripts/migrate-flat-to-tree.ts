/**
 * Migra JSONs planos (api/fipe/veiculos + historico) para arvore estatica.
 * public/data/fipe/{marca}/{modelo}/{ano}.json
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from './lib/fipe-paths.js';
import { marcaSlug, veiculoId } from './lib/fipe-slug.js';
import { writeVehicleJson } from './lib/vehicle-paths.js';

const SOURCES = [
  PATHS.legacyVeiculos,
  PATHS.legacyHistorico,
].filter((d) => fs.existsSync(d));

function parseValor(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n);
}

function normalize(raw: Record<string, unknown>) {
  const marca = String(raw.marca || 'Geral');
  const modelo = String(raw.modelo || raw.nome || 'modelo').replace(/\s*\(\d{4}\)\s*$/, '');
  const ano = Number(raw.anoModelo || raw.ano || 0);
  if (!ano) return null;

  const id = String(
    raw.id || raw.slug || veiculoId(marca, modelo, ano),
  );
  const valor = parseValor(raw.valorAtual ?? raw.valor);
  const fipeCodigo = String(raw.fipeCodigo || raw.codigoFipe || '');

  return {
    id,
    slug: id,
    codigoFipe: fipeCodigo,
    marca,
    modelo,
    ano,
    combustivel: String(raw.combustivel || 'Flex'),
    valor,
    valorFormatado: valor > 0 ? `R$ ${valor.toLocaleString('pt-BR')}` : '',
    tipo: String(raw.tipo || 'carros'),
    mesReferencia: String(raw.mesReferencia || ''),
    nome: String(raw.nome || `${marca} ${modelo} (${ano})`),
    historicoPrecos: Array.isArray(raw.historicoPrecos) ? raw.historicoPrecos : [],
  };
}

function walkJsonDirs(dir: string): string[] {
  const out: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.json')) out.push(path.join(dir, f));
  }
  return out;
}

function main() {
  console.log('=== Migrate flat -> tree ===');
  const veiculos: ReturnType<typeof normalize>[] = [];
  const seen = new Set<string>();

  for (const dir of SOURCES) {
    for (const file of walkJsonDirs(dir)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
      const v = normalize(raw);
      if (!v || seen.has(v.id)) continue;
      seen.add(v.id);

      const { publicPath } = writeVehicleJson(
        {
          marca: v.marca,
          modelo: v.modelo,
          ano: v.ano,
          combustivel: v.combustivel,
          fipeCodigo: v.codigoFipe,
        },
        v,
      );

      veiculos.push({ ...v, dataPath: publicPath });
    }
  }

  fs.mkdirSync(path.dirname(PATHS.srcVeiculos), { recursive: true });
  fs.writeFileSync(PATHS.srcVeiculos, JSON.stringify(veiculos));

  if (fs.existsSync(PATHS.srcMarcas)) {
    fs.copyFileSync(PATHS.srcMarcas, PATHS.publicMarcas);
  } else if (fs.existsSync(path.join(process.cwd(), 'public', 'api', 'fipe', 'marcas.json'))) {
    fs.mkdirSync(path.dirname(PATHS.publicMarcas), { recursive: true });
    fs.copyFileSync(
      path.join(process.cwd(), 'public', 'api', 'fipe', 'marcas.json'),
      PATHS.publicMarcas,
    );
  }

  const marcas = new Set(veiculos.map((v) => marcaSlug(v!.marca)));
  if (!fs.existsSync(PATHS.publicMarcas) && marcas.size) {
    fs.mkdirSync(path.dirname(PATHS.publicMarcas), { recursive: true });
    fs.writeFileSync(
      PATHS.publicMarcas,
      JSON.stringify([...marcas].sort().map((slug) => ({ slug, nome: slug }))),
    );
  }

  console.log(`Migrados: ${veiculos.length} veiculos -> ${PATHS.publicDataRoot}`);
}

main();
