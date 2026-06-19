/**
 * Bootstrap do catalogo a partir de historico existente + busca-rapida.
 * Gera veiculos.json, copia detalhes para public/api/fipe/veiculos e shards de busca.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const HISTORICO = path.join(ROOT, 'public', 'api', 'historico');
const BUSCA = path.join(ROOT, 'public', 'api', 'busca-rapida.json');
const SRC = path.join(ROOT, 'src', 'data', 'fipe');
const OUT_VEICULOS = path.join(ROOT, 'public', 'api', 'fipe', 'veiculos');
const SEARCH_DIR = path.join(ROOT, 'public', 'api', 'fipe', 'search');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function marcaSlug(marca) {
  const l = marca.toLowerCase();
  if (l.includes('chevrolet') || l.includes('gm')) return 'chevrolet';
  if (l.includes('volkswagen') || l.includes('vw')) return 'volkswagen';
  return slugify(marca);
}

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

function gerarTermoBusca(v) {
  const ms = marcaSlug(v.marca);
  let base = `${ms} ${v.modelo} ${v.combustivel || ''} ${v.ano}`.toLowerCase();
  if (v.tipo === 'motos') base += ' moto';
  if (v.tipo === 'caminhoes') base += ' caminhao';
  return base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function main() {
  console.log('=== Bootstrap catalogo (historico) ===');

  const buscaMap = new Map();
  if (fs.existsSync(BUSCA)) {
    for (const item of JSON.parse(fs.readFileSync(BUSCA, 'utf-8'))) {
      buscaMap.set(item.id, item);
    }
  }

  const veiculos = [];
  const seen = new Set();

  if (fs.existsSync(HISTORICO)) {
    fs.mkdirSync(OUT_VEICULOS, { recursive: true });
    for (const file of fs.readdirSync(HISTORICO).filter((f) => f.endsWith('.json'))) {
      const v = JSON.parse(fs.readFileSync(path.join(HISTORICO, file), 'utf-8'));
      const id = v.id || file.replace('.json', '');
      if (seen.has(id)) continue;
      seen.add(id);
      const rec = vehicleToRecord(v, buscaMap.get(id));
      if (!rec) continue;
      veiculos.push(rec);
      fs.writeFileSync(path.join(OUT_VEICULOS, `${id}.json`), JSON.stringify({
        ...v,
        id,
        slug: id,
        tipo: rec.tipo,
        valorAtual: rec.valor,
      }));
    }
  }

  for (const [id, item] of buscaMap) {
    if (seen.has(id)) continue;
    seen.add(id);
    const rec = vehicleToRecord({ id, nome: item.nome, valorAtual: item.valor }, item);
    if (rec) veiculos.push(rec);
  }

  fs.mkdirSync(SRC, { recursive: true });
  fs.writeFileSync(path.join(SRC, 'veiculos.json'), JSON.stringify(veiculos));
  fs.writeFileSync(path.join(SRC, 'marcas.json'), JSON.stringify([]));
  fs.writeFileSync(path.join(SRC, 'modelos.json'), JSON.stringify([]));

  const shards = {};
  for (const v of veiculos) {
    const nome = `${v.marca} ${v.modelo} (${v.ano})`;
    const termo = gerarTermoBusca(v);
    const first = (termo[0] || '0').toLowerCase();
    const key = /[a-z]/.test(first) ? first : '0';
    if (!shards[key]) shards[key] = [];
    shards[key].push({
      i: v.id,
      n: nome,
      m: marcaSlug(v.marca),
      a: v.ano,
      v: v.valor,
      t: v.tipo,
      c: v.combustivel,
      s: termo,
    });
  }

  fs.mkdirSync(SEARCH_DIR, { recursive: true });
  const manifest = {
    shards: Object.keys(shards).sort(),
    total: veiculos.length,
    geradoEm: new Date().toISOString(),
    path: '/api/fipe/search/',
  };
  fs.writeFileSync(path.join(SEARCH_DIR, 'manifest.json'), JSON.stringify(manifest));
  for (const [key, items] of Object.entries(shards)) {
    fs.writeFileSync(path.join(SEARCH_DIR, `shard-${key}.json`), JSON.stringify(items));
  }
  fs.writeFileSync(path.join(SRC, 'search-index.json'), JSON.stringify(manifest, null, 2));

  console.log(`Veiculos bootstrap: ${veiculos.length}`);
  console.log(`Shards: ${manifest.shards.length} em ${SEARCH_DIR}`);
}

main();
