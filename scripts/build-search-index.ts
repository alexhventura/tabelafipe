/**
 * Gera indice de busca a partir do catalogo estatico.
 * Saida: public/data/fipe/search/ + src/data/fipe/search-index.json
 */

import fs from 'fs';
import path from 'path';
import { PATHS } from './lib/fipe-paths.js';
import { marcaSlug } from './lib/fipe-slug.js';
import { vehiclePublicPath } from './lib/vehicle-paths.js';
import {
  extractFamilyName,
  formatFamilyDisplay,
  modeloTokens,
  normalizeText,
} from '../src/lib/modelFamily.ts';

interface VeiculoRecord {
  id: string;
  marca: string;
  modelo: string;
  ano: number;
  combustivel?: string;
  valor?: number;
  tipo: string;
  dataPath?: string;
  fipeCodigo?: string;
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
  modelo: string;
  dataPath: string;
  fipeCodigo?: string;
  canonicalPath?: string;
  pageSlug?: string;
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
  mo: string;
  f?: string;
  cp?: string;
}

interface CompactFamily {
  id: string;
  fa: string;
  fd: string;
  m: string;
  md: string;
  t: string;
  n: number;
  vmin: number;
  vmax: number;
  amin: number;
  amax: number;
  cp?: string;
}

function hubPathForFamily(marcaSlugVal: string, familia: string): string | undefined {
  const hubFile = path.join(PATHS.hubBundlesRoot, 'familia', marcaSlugVal, `${familia}.json`);
  if (!fs.existsSync(hubFile)) return `/fipe/${marcaSlugVal}/${familia}/`;
  try {
    const hub = JSON.parse(fs.readFileSync(hubFile, 'utf-8')) as { canonicalPath?: string };
    return hub.canonicalPath ?? `/fipe/${marcaSlugVal}/${familia}/`;
  } catch {
    return `/fipe/${marcaSlugVal}/${familia}/`;
  }
}

function buildFamilyIndex(index: SearchIndexItem[]): CompactFamily[] {
  const groups = new Map<string, CompactFamily>();

  for (const item of index) {
    const familia = extractFamilyName(item.modelo);
    if (!familia) continue;
    const ms = marcaSlug(item.marca);
    const id = `${ms}|${familia}`;
    const existing = groups.get(id);
    const valor = item.valor > 0 ? item.valor : 0;

    if (!existing) {
      groups.set(id, {
        id,
        fa: familia,
        fd: formatFamilyDisplay(familia),
        m: ms,
        md: item.marca,
        t: item.tipo,
        n: 1,
        vmin: valor,
        vmax: valor,
        amin: item.ano,
        amax: item.ano,
        cp: hubPathForFamily(ms, familia),
      });
      continue;
    }

    existing.n += 1;
    if (valor > 0) {
      existing.vmin = existing.vmin > 0 ? Math.min(existing.vmin, valor) : valor;
      existing.vmax = Math.max(existing.vmax, valor);
    }
    existing.amin = Math.min(existing.amin, item.ano);
    existing.amax = Math.max(existing.amax, item.ano);
  }

  return [...groups.values()].sort((a, b) => a.fa.localeCompare(b.fa));
}

function gerarFamilyShards(families: CompactFamily[]) {
  const shards: Record<string, CompactFamily[]> = {};
  for (const family of families) {
    const key = /[a-z]/.test(family.fa[0]) ? family.fa[0] : '0';
    if (!shards[key]) shards[key] = [];
    shards[key].push(family);
  }

  const manifest = {
    shards: Object.keys(shards).sort(),
    total: families.length,
    geradoEm: new Date().toISOString(),
    path: '/data/fipe/search/',
  };

  fs.writeFileSync(
    path.join(PATHS.publicSearchDir, 'families-manifest.json'),
    JSON.stringify(manifest),
  );
  for (const [key, items] of Object.entries(shards)) {
    fs.writeFileSync(
      path.join(PATHS.publicSearchDir, `family-shard-${key}.json`),
      JSON.stringify(items),
    );
  }
  return manifest;
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

function loadUrlMap(): Record<string, { canonicalPath?: string; pageSlug?: string }> {
  const candidates = [PATHS.publicVehicleUrlMap, PATHS.vehicleUrlMap];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  }
  return {};
}

function buildIndex(veiculos: VeiculoRecord[], urlMap: Record<string, { canonicalPath?: string; pageSlug?: string }>): SearchIndexItem[] {
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

    const urlEntry = urlMap[v.id];
    index.push({
      id: v.id,
      termoBusca: gerarTermoBusca(v),
      nome,
      valor: v.valor && v.valor > 0 ? v.valor : 0,
      marca: v.marca,
      ano: v.ano,
      combustivel: v.combustivel || 'Flex',
      tipo: v.tipo,
      modelo: v.modelo,
      searchText: normalizeText(`${v.marca} ${v.modelo}`),
      fipeCodigo: v.fipeCodigo,
      canonicalPath: urlEntry?.canonicalPath,
      pageSlug: urlEntry?.pageSlug,
      dataPath,
    });
  }

  return index;
}

function shardKeysForItem(item: SearchIndexItem): string[] {
  const keys = new Set<string>();
  const tokens = modeloTokens(item.modelo);
  for (const word of tokens) {
    if (/[a-z]/.test(word[0])) keys.add(word[0]);
  }
  if (!keys.size) {
    const fallback = normalizeText(item.modelo)[0] || item.termoBusca[0] || '0';
    keys.add(/[a-z]/.test(fallback) ? fallback : '0');
  }
  return [...keys];
}

function gerarShards(index: SearchIndexItem[]) {
  const shards: Record<string, CompactItem[]> = {};

  for (const item of index) {
    const compact: CompactItem = {
      i: item.id,
      n: item.nome,
      m: marcaSlug(item.marca),
      a: item.ano,
      v: item.valor,
      t: item.tipo,
      c: item.combustivel,
      s: item.termoBusca,
      mo: normalizeText(item.modelo),
      p: item.dataPath,
      f: item.fipeCodigo,
      cp: item.canonicalPath,
    };
    for (const key of shardKeysForItem(item)) {
      if (!shards[key]) shards[key] = [];
      shards[key].push(compact);
    }
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
  const urlMap = loadUrlMap();
  const comPreco = veiculos.filter((v) => v.valor && v.valor > 0);
  console.log(`Veiculos no catalogo: ${veiculos.length}`);
  console.log(`Com preco: ${comPreco.length}`);

  const index = buildIndex(veiculos, urlMap);
  const manifest = gerarShards(index);
  const familyManifest = gerarFamilyShards(buildFamilyIndex(index));

  const searchManifest = {
    ...manifest,
    families: familyManifest.total,
    familyShards: familyManifest.shards,
    path: '/data/fipe/search/',
    veiculosSemPreco: veiculos.length - comPreco.length,
  };

  fs.mkdirSync(path.dirname(PATHS.srcSearchIndex), { recursive: true });
  fs.writeFileSync(PATHS.srcSearchIndex, JSON.stringify(searchManifest, null, 2));

  console.log(`Indice gerado: ${index.length} itens`);
  console.log(`Familias: ${familyManifest.total}`);
  console.log(`Shards: ${manifest.shards.length} em ${PATHS.publicSearchDir}`);
}

main();
