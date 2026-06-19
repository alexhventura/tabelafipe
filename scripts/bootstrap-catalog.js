/**
 * Bootstrap: historico legado -> arvore estatica public/data/fipe + shards.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from './lib/fipe-paths.js';
import { marcaSlug, veiculoId } from './lib/fipe-slug.js';
import { writeVehicleJson } from './lib/vehicle-paths.js';

const ROOT = process.cwd();
const HISTORICO = path.join(ROOT, 'public', 'api', 'historico');
const BUSCA = path.join(ROOT, 'public', 'api', 'busca-rapida.json');

function inferTipo(nome, termo) {
  const t = `${nome} ${termo || ''}`.toLowerCase();
  if (/\b(cg|cb|biz|moto|motocicleta|yamaha|suzuki)\b/.test(t) && !/cargo|motorhome/.test(t)) {
    return 'motos';
  }
  if (/\b(caminhao|caminhoes|truck|scania|volvo fh|mercedes actros)\b/.test(t)) return 'caminhoes';
  return 'carros';
}

function vehicleToRecord(v, fallback) {
  const id = v.id || fallback?.id;
  if (!id) return null;
  const ano = v.anoModelo || fallback?.ano || parseInt(String(v.nome).match(/\((\d{4})\)/)?.[1] || '0', 10);
  return {
    id,
    slug: id,
    tipo: v.tipo || fallback?.tipo || inferTipo(v.nome, fallback?.termoBusca),
    marca: v.marca || fallback?.marca || 'Geral',
    marcaCodigo: v.marcaCodigo || '0',
    marcaSlug: marcaSlug(v.marca || fallback?.marca || 'geral'),
    modelo: v.modelo || v.nome?.replace(/\s*\(\d{4}\)\s*$/, '') || id,
    modeloCodigo: v.modeloCodigo || '0',
    ano,
    anoCodigo: v.anoCodigo || String(ano),
    anoNome: String(ano),
    combustivel: v.combustivel || fallback?.combustivel || 'Flex',
    fipeCodigo: v.fipeCodigo || v.codigoFipe || '',
    valor: v.valorAtual || v.valor || fallback?.valor || 0,
    mesReferencia: v.mesReferencia || 'Jun/2026',
  };
}

function main() {
  console.log('=== Bootstrap catalogo (historico -> arvore) ===');

  const buscaMap = new Map();
  if (fs.existsSync(BUSCA)) {
    for (const item of JSON.parse(fs.readFileSync(BUSCA, 'utf-8'))) {
      buscaMap.set(item.id, item);
    }
  }

  const veiculos = [];
  const seen = new Set();

  if (fs.existsSync(HISTORICO)) {
    for (const file of fs.readdirSync(HISTORICO).filter((f) => f.endsWith('.json'))) {
      const v = JSON.parse(fs.readFileSync(path.join(HISTORICO, file), 'utf-8'));
      const id = v.id || file.replace('.json', '');
      if (seen.has(id)) continue;
      seen.add(id);
      const rec = vehicleToRecord(v, buscaMap.get(id));
      if (!rec) continue;

      const { publicPath } = writeVehicleJson(
        {
          marca: rec.marca,
          modelo: rec.modelo,
          ano: rec.ano,
          combustivel: rec.combustivel,
          fipeCodigo: rec.fipeCodigo,
        },
        {
          ...v,
          id,
          slug: id,
          codigoFipe: rec.fipeCodigo,
          tipo: rec.tipo,
          valor: rec.valor,
          valorAtual: rec.valor,
          valorFormatado: rec.valor ? `R$ ${rec.valor.toLocaleString('pt-BR')}` : '',
        },
      );

      veiculos.push({ ...rec, dataPath: publicPath });
    }
  }

  for (const [id, item] of buscaMap) {
    if (seen.has(id)) continue;
    seen.add(id);
    const rec = vehicleToRecord({ id, nome: item.nome, valorAtual: item.valor }, item);
    if (!rec) continue;
    const { publicPath } = writeVehicleJson(
      { marca: rec.marca, modelo: rec.modelo, ano: rec.ano, combustivel: rec.combustivel },
      {
        id,
        slug: id,
        marca: rec.marca,
        modelo: rec.modelo,
        ano: rec.ano,
        valor: rec.valor,
        tipo: rec.tipo,
        nome: item.nome,
      },
    );
    veiculos.push({ ...rec, dataPath: publicPath });
  }

  fs.mkdirSync(path.dirname(PATHS.srcVeiculos), { recursive: true });
  fs.writeFileSync(PATHS.srcVeiculos, JSON.stringify(veiculos));
  fs.writeFileSync(PATHS.srcMarcas, JSON.stringify([]));
  fs.writeFileSync(PATHS.srcModelos, JSON.stringify([]));

  console.log(`Veiculos bootstrap: ${veiculos.length}`);
  console.log(`Arvore: ${PATHS.publicDataRoot}`);
}

main();
