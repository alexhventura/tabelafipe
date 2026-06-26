/**
 * Builds static SEO indexes from veiculos.json and optional history files.
 * Usage: node scripts/build-seo-index.js [--limit-models N]
 */
import fs from 'fs';
import path from 'path';
import { marcaSlug, modeloSlug } from './lib/fipe-slug.js';

function formatWordToken(word) {
  if (!word) return '';
  if (word.includes('.')) {
    return word
      .split('.')
      .map((segment) => (segment ? formatWordToken(segment) : ''))
      .join('.');
  }
  const lower = word.toLowerCase();
  if (lower.length <= 3 && /^[a-z0-9]+$/i.test(word)) return lower.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatTitleCase(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/(\s+|\/|-)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === '-' || part === '/') return part;
      return formatWordToken(part);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

const KNOWN_BRAND_NAMES = {
  volkswagen: 'Volkswagen',
  chevrolet: 'Chevrolet',
  'mercedes-benz': 'Mercedes-Benz',
  fiat: 'Fiat',
  ford: 'Ford',
  honda: 'Honda',
  toyota: 'Toyota',
  hyundai: 'Hyundai',
};

function formatBrandName(marca, slug) {
  if (slug && KNOWN_BRAND_NAMES[slug]) return KNOWN_BRAND_NAMES[slug];
  const stripped = String(marca || '').replace(/^(gm|vw)\s*-\s*/i, '').trim();
  return formatTitleCase(stripped || marca);
}

const ROOT = process.cwd();
const VEICULOS_PATH = path.join(ROOT, 'src', 'data', 'fipe', 'veiculos.json');
const HISTORY_DIR = path.join(ROOT, 'data', 'history');
const SEO_DIR = path.join(ROOT, 'public', 'data', 'seo');
const MODELOS_DIR = path.join(SEO_DIR, 'modelos');

const MODELO_SEGMENTO = {
  corolla: 'sedan-medio',
  civic: 'sedan-medio',
  sentra: 'sedan-medio',
  cruze: 'sedan-medio',
  jetta: 'sedan-medio',
  onix: 'hatch-popular',
  hb20: 'hatch-popular',
  polo: 'hatch-popular',
  argo: 'hatch-popular',
  '208': 'hatch-popular',
  gol: 'hatch-popular',
  mobi: 'hatch-popular',
  kwid: 'hatch-popular',
  renegade: 'suv-compacto',
  compass: 'suv-compacto',
  creta: 'suv-compacto',
  tracker: 'suv-compacto',
  kicks: 'suv-compacto',
  'hr-v': 'suv-compacto',
  hrv: 'suv-compacto',
};

const SEGMENTO_RIVAIS = {
  'sedan-medio': ['corolla', 'civic', 'sentra', 'cruze', 'jetta'],
  'hatch-popular': ['onix', 'hb20', 'polo', 'argo', '208', 'gol'],
  'suv-compacto': ['creta', 'tracker', 'kicks', 'hr-v', 'renegade', 'compass'],
};

function parseArgs(argv) {
  const args = { limitModels: 0 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--limit-models' && argv[i + 1]) {
      args.limitModels = Math.max(0, parseInt(argv[++i], 10) || 0);
    }
  }
  return args;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

function modelKey(mSlug, modSlug) {
  return `${mSlug}|${modSlug}`;
}

function modelFileName(mSlug, modSlug) {
  return `${mSlug}-${modSlug}.json`;
}

function pickModeloNome(modelos) {
  const counts = new Map();
  for (const m of modelos) {
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  let best = modelos[0];
  let bestCount = 0;
  for (const [nome, c] of counts) {
    if (c > bestCount) {
      best = nome;
      bestCount = c;
    }
  }
  return best;
}

function aggregateHistorico(vehicleIds) {
  const byRef = new Map();
  let filesRead = 0;
  for (const id of vehicleIds) {
    const hp = path.join(HISTORY_DIR, `${id}.json`);
    if (!fs.existsSync(hp)) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(hp, 'utf-8'));
    } catch {
      continue;
    }
    filesRead++;
    for (const pt of data.historico || []) {
      if (!pt?.referencia || typeof pt.valor !== 'number') continue;
      const cur = byRef.get(pt.referencia) || { sum: 0, count: 0 };
      cur.sum += pt.valor;
      cur.count += 1;
      byRef.set(pt.referencia, cur);
    }
  }

  if (byRef.size === 0) {
    return {
      menorPreco: null,
      maiorPreco: null,
      valorMedio: null,
      valorizacaoPercentual: null,
      desvalorizacaoPercentual: null,
      pontos: [],
      _filesRead: filesRead,
    };
  }

  const pontos = [...byRef.entries()]
    .map(([referencia, { sum, count }]) => ({
      referencia,
      valorMedio: Math.round(sum / count),
    }))
    .sort((a, b) => {
      const parseRef = (r) => {
        const [mon, yy] = r.split('/');
        const months = {
          jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
          jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
        };
        const m = months[(mon || '').toLowerCase()] || 0;
        const y = 2000 + parseInt(yy || '0', 10);
        return y * 12 + m;
      };
      return parseRef(a.referencia) - parseRef(b.referencia);
    });

  const valores = pontos.map((p) => p.valorMedio);
  const menorPreco = Math.min(...valores);
  const maiorPreco = Math.max(...valores);
  const valorMedio = Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
  const first = pontos[0].valorMedio;
  const last = pontos[pontos.length - 1].valorMedio;
  let valorizacaoPercentual = null;
  let desvalorizacaoPercentual = null;
  if (first > 0) {
    const pct = ((last - first) / first) * 100;
    const rounded = Math.round(pct * 100) / 100;
    if (pct >= 0) valorizacaoPercentual = rounded;
    else desvalorizacaoPercentual = Math.abs(rounded);
  }

  return {
    menorPreco,
    maiorPreco,
    valorMedio,
    valorizacaoPercentual,
    desvalorizacaoPercentual,
    pontos,
    _filesRead: filesRead,
  };
}

function buildComparativos(modelIndexByRival) {
  const pairs = [];
  const seen = new Set();

  for (const [segmento, rivais] of Object.entries(SEGMENTO_RIVAIS)) {
    const entries = rivais.map((r) => modelIndexByRival.get(r)).filter(Boolean);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        const slugs = [a.modeloSlug, b.modeloSlug].sort();
        const slug = `${slugs[0]}-vs-${slugs[1]}`;
        if (seen.has(slug)) continue;
        seen.add(slug);
        const score = a.totalVeiculos + b.totalVeiculos;
        pairs.push({
          slug,
          segmento,
          score,
          a: {
            marcaSlug: a.marcaSlug,
            modeloSlug: a.modeloSlug,
            marcaNome: a.marcaNome,
            modeloNome: a.modeloNome,
            totalVeiculos: a.totalVeiculos,
            valorMedio: a.valorMedio,
          },
          b: {
            marcaSlug: b.marcaSlug,
            modeloSlug: b.modeloSlug,
            marcaNome: b.marcaNome,
            modeloNome: b.modeloNome,
            totalVeiculos: b.totalVeiculos,
            valorMedio: b.valorMedio,
          },
        });
      }
    }
  }

  pairs.sort((x, y) => y.score - x.score);
  return pairs.slice(0, 80);
}

function resolveRivalSlug(modSlug) {
  if (MODELO_SEGMENTO[modSlug]) return modSlug;
  for (const key of Object.keys(MODELO_SEGMENTO)) {
    if (
      modSlug === key ||
      modSlug.startsWith(`${key}-`) ||
      modSlug.includes(`-${key}-`) ||
      modSlug.endsWith(`-${key}`)
    ) {
      return key;
    }
  }
  return null;
}

function main() {
  const { limitModels } = parseArgs(process.argv);
  const t0 = Date.now();
  const errors = [];

  if (!fs.existsSync(VEICULOS_PATH)) {
    console.error('Missing', VEICULOS_PATH);
    process.exit(1);
  }

  const veiculos = JSON.parse(fs.readFileSync(VEICULOS_PATH, 'utf-8'));
  const models = new Map();
  const marcas = new Map();
  const anosMap = new Map();

  for (const v of veiculos) {
    const mSlug = v.marcaSlug || marcaSlug(v.marca);
    const modSlug = modeloSlug(v.modelo);
    const key = modelKey(mSlug, modSlug);

    if (!models.has(key)) {
      models.set(key, {
        marcaSlug: mSlug,
        marcaNome: v.marca,
        modeloSlug: modSlug,
        modeloNomes: [],
        tipo: v.tipo,
        vehicles: [],
      });
    }
    const m = models.get(key);
    m.modeloNomes.push(v.modelo);
    m.vehicles.push(v);
    if (!m.tipo && v.tipo) m.tipo = v.tipo;

    const marcaKey = `${v.tipo || 'carros'}|${mSlug}`;

    if (!marcas.has(marcaKey)) {
      marcas.set(marcaKey, {
        slug: mSlug,
        nome: v.marca,
        tipo: v.tipo || 'carros',
        totalVeiculos: 0,
        modelosMap: new Map(),
      });
    }
    const marca = marcas.get(marcaKey);
    marca.totalVeiculos++;
    if (!marca.tipo && v.tipo) marca.tipo = v.tipo;
    if (!marca.modelosMap.has(modSlug)) {
      marca.modelosMap.set(modSlug, { slug: modSlug, nome: v.modelo, totalVeiculos: 0 });
    }
    marca.modelosMap.get(modSlug).totalVeiculos++;

    const ano = Number(v.ano);
    if (!Number.isNaN(ano)) {
      if (!anosMap.has(ano)) {
        anosMap.set(ano, {
          ano,
          totalVeiculos: 0,
          marcas: new Set(),
          modelos: new Set(),
          top: [],
        });
      }
      const ay = anosMap.get(ano);
      ay.totalVeiculos++;
      ay.marcas.add(mSlug);
      ay.modelos.add(key);
      ay.top.push({
        id: v.id,
        marcaSlug: mSlug,
        nome: `${v.marca} ${v.modelo}`.trim(),
        valor: v.valor ?? 0,
      });
    }
  }

  fs.mkdirSync(MODELOS_DIR, { recursive: true });

  const modelList = [...models.values()].sort((a, b) => b.vehicles.length - a.vehicles.length);
  const modelsToWrite = limitModels > 0 ? modelList.slice(0, limitModels) : modelList;
  const writeKeys = new Set(modelsToWrite.map((m) => modelKey(m.marcaSlug, m.modeloSlug)));

  const modelPaths = [];
  let historyFilesRead = 0;

  for (const m of modelList) {
    const key = modelKey(m.marcaSlug, m.modeloSlug);
    if (!writeKeys.has(key)) continue;

    const anos = [...new Set(m.vehicles.map((v) => Number(v.ano)).filter((n) => !Number.isNaN(n)))].sort(
      (a, b) => a - b,
    );
    const versoes = m.vehicles.map((v) => ({
      id: v.id,
      ano: v.ano,
      combustivel: v.combustivel,
      valor: v.valor,
      fipeCodigo: v.fipeCodigo,
    }));
    const historicoRaw = aggregateHistorico(m.vehicles.map((v) => v.id));
    historyFilesRead += historicoRaw._filesRead || 0;
    const { _filesRead, ...historico } = historicoRaw;

    const detail = {
      marcaSlug: m.marcaSlug,
      marcaNome: formatBrandName(m.marcaNome, m.marcaSlug),
      modeloSlug: m.modeloSlug,
      modeloNome: formatTitleCase(pickModeloNome(m.modeloNomes)),
      totalVeiculos: m.vehicles.length,
      anos,
      versoes,
      historico,
    };

    const rel = path.join('modelos', modelFileName(m.marcaSlug, m.modeloSlug));
    const abs = path.join(SEO_DIR, rel);
    try {
      writeJson(abs, detail);
      modelPaths.push(`/data/seo/${rel.split(path.sep).join('/')}`);
    } catch (err) {
      errors.push({ file: abs, error: String(err) });
    }
  }

  const marcasOut = [...marcas.values()]
    .map((marca) => ({
      slug: marca.slug,
      nome: formatBrandName(marca.nome, marca.slug),
      tipo: marca.tipo || 'carros',
      totalVeiculos: marca.totalVeiculos,
      totalModelos: marca.modelosMap.size,
      modelos: [...marca.modelosMap.values()]
        .map((m) => ({ ...m, nome: formatTitleCase(m.nome) }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  writeJson(path.join(SEO_DIR, 'marcas.json'), marcasOut);
  writeJson(
    path.join(SEO_DIR, 'marcas-index.json'),
    marcasOut.map(({ slug, nome, tipo, totalVeiculos, totalModelos }) => ({
      slug,
      nome,
      tipo,
      totalVeiculos,
      totalModelos,
    })),
  );

  const anosOut = {
    anos: [...anosMap.values()]
      .sort((a, b) => b.ano - a.ano)
      .map((ay) => {
        ay.top.sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
        return {
          ano: ay.ano,
          totalVeiculos: ay.totalVeiculos,
          marcas: ay.marcas.size,
          modelos: ay.modelos.size,
          topVeiculos: ay.top.slice(0, 10),
        };
      }),
  };
  writeJson(path.join(SEO_DIR, 'anos.json'), anosOut);

  const modelIndexByRival = new Map();
  for (const m of modelList) {
    const rival = resolveRivalSlug(m.modeloSlug);
    if (!rival) continue;
    const avgValor = m.vehicles.reduce((s, v) => s + (v.valor ?? 0), 0) / m.vehicles.length;
    const cur = modelIndexByRival.get(rival);
    if (!cur || m.vehicles.length > cur.totalVeiculos) {
      modelIndexByRival.set(rival, {
        marcaSlug: m.marcaSlug,
        modeloSlug: m.modeloSlug,
        marcaNome: m.marcaNome,
        modeloNome: pickModeloNome(m.modeloNomes),
        totalVeiculos: m.vehicles.length,
        valorMedio: Math.round(avgValor),
      });
    }
  }

  const comparativos = buildComparativos(modelIndexByRival);
  writeJson(path.join(SEO_DIR, 'comparativos.json'), { pares: comparativos });

  const manifest = {
    geradoEm: new Date().toISOString(),
    limitModels: limitModels || null,
    counts: {
      veiculos: veiculos.length,
      marcas: marcasOut.length,
      modelosTotal: models.size,
      modelosGerados: modelPaths.length,
      anos: anosOut.anos.length,
      comparativos: comparativos.length,
      historyFilesRead,
    },
    paths: {
      marcas: '/data/seo/marcas.json',
      marcasIndex: '/data/seo/marcas-index.json',
      anos: '/data/seo/anos.json',
      comparativos: '/data/seo/comparativos.json',
      modelosDir: '/data/seo/modelos/',
      modelos: modelPaths,
    },
  };
  writeJson(path.join(SEO_DIR, 'manifest.json'), manifest);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('SEO index build complete in', elapsed + 's');
  console.log(JSON.stringify(manifest.counts, null, 2));
  if (errors.length) {
    console.error('Errors:', errors.length);
    console.error(JSON.stringify(errors.slice(0, 5), null, 2));
  }
}

main();
