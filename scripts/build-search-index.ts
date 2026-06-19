/**
 * Gera indice de busca a partir do catalogo estatico.
 * Saida: public/data/fipe/search/ + src/data/fipe/search-index.json
 */

import fs from 'fs';
import path from 'path';
import { PATHS } from './lib/fipe-paths.js';
import { marcaSlug } from './lib/fipe-slug.js';
import { vehiclePublicPath } from './lib/vehicle-paths.js';

interface VeiculoRecord {
  id: string;
  marca: string;
  modelo: string;
  ano: number;
  combustivel?: string;
  valor?: number;
  tipo: string;
  dataPath?: string;
}

interface SearchIndexItem {
  id: string;
  termoBusca: string;
  nome: string;
  valor: number;
  marca: string;
  ano: number;
  combustivel: string;
  tipo: string;
  searchText: string;
  dataPath: string;
}

interface CompactItem {
  i: string;
  n: string;
  m: string;
  a: number;
  v: number;
  t: string;
  c: string;
  s: string;
  p: string;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function gerarTermoBusca(v: VeiculoRecord): string {
  const ms = marcaSlug(v.marca);
  let base = `${ms} ${v.modelo} ${v.combustivel || ''} ${v.ano}`.toLowerCase();
  if (v.tipo === 'motos') base += ' moto';
  if (v.tipo === 'caminhoes') base += ' caminhao';
  return normalizeText(base);
}

function loadVeiculos(): VeiculoRecord[] {
  if (fs.existsSync(PATHS.srcVeiculos)) {
    const data = JSON.parse(fs.readFileSync(PATHS.srcVeiculos, 'utf-8'));
    if (Array.isArray(data) && data.length) return data;
  }
  return [];
}

function buildIndex(veiculos: VeiculoRecord[]): SearchIndexItem[] {
  const seen = new Set<string>();
  const index: SearchIndexItem[] = [];

  for (const v of veiculos) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);

    const nome = `${v.marca} ${v.modelo} (${v.ano})`;
    const dataPath =
      v.dataPath ||
      vehiclePublicPath({
        marca: v.marca,
        modelo: v.modelo,
        ano: v.ano,
        combustivel: v.combustivel,
      });

    index.push({
      id: v.id,
      termoBusca: gerarTermoBusca(v),
      nome,
      valor: v.valor && v.valor > 0 ? v.valor : 0,
      marca: v.marca,
      ano: v.ano,
      combustivel: v.combustivel || 'Flex',
      tipo: v.tipo,
      searchText: normalizeText(nome),
      dataPath,
    });
  }

  return index;
}

function gerarShards(index: SearchIndexItem[]) {
  const shards: Record<string, CompactItem[]> = {};

  for (const item of index) {
    const first = (item.termoBusca[0] || '0').toLowerCase();
    const key = /[a-z]/.test(first) ? first : '0';
    if (!shards[key]) shards[key] = [];
    shards[key].push({
      i: item.id,
      n: item.nome,
      m: marcaSlug(item.marca),
      a: item.ano,
      v: item.valor,
      t: item.tipo,
      c: item.combustivel,
      s: item.termoBusca,
      p: item.dataPath,
    });
  }

  fs.mkdirSync(PATHS.publicSearchDir, { recursive: true });

  const manifest = {
    shards: Object.keys(shards).sort(),
    total: index.length,
    geradoEm: new Date().toISOString(),
    path: '/data/fipe/search/',
  };

  fs.writeFileSync(PATHS.publicSearchManifest, JSON.stringify(manifest));
  for (const [key, items] of Object.entries(shards)) {
    fs.writeFileSync(
      path.join(PATHS.publicSearchDir, `shard-${key}.json`),
      JSON.stringify(items),
    );
  }

  return manifest;
}

function main() {
  console.log('=== Build Search Index ===');

  const veiculos = loadVeiculos();
  const comPreco = veiculos.filter((v) => v.valor && v.valor > 0);
  console.log(`Veiculos no catalogo: ${veiculos.length}`);
  console.log(`Com preco: ${comPreco.length}`);

  const index = buildIndex(veiculos);
  const manifest = gerarShards(index);

  const searchManifest = {
    ...manifest,
    path: '/data/fipe/search/',
    veiculosSemPreco: veiculos.length - comPreco.length,
  };

  fs.mkdirSync(path.dirname(PATHS.srcSearchIndex), { recursive: true });
  fs.writeFileSync(PATHS.srcSearchIndex, JSON.stringify(searchManifest, null, 2));

  console.log(`Indice gerado: ${index.length} itens`);
  console.log(`Shards: ${manifest.shards.length} em ${PATHS.publicSearchDir}`);
}

main();
