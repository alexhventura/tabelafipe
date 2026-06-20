/**
 * Builds semantic intent indexes from SEO modelo JSON files.
 * Usage: node scripts/build-semantic-index.js [--limit N]
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SEO_DIR = path.join(ROOT, 'public', 'data', 'seo');
const MODELOS_DIR = path.join(SEO_DIR, 'modelos');
const OUT_DIR = path.join(ROOT, 'public', 'data', 'semantic');

const INTENTS = [
  'preco',
  'fipe-atualizada',
  'vale-a-pena',
  'comparativo',
  'consumo',
  'manutencao',
  'problemas',
  'seguro',
];

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

const INTENT_CONCORRENCIA = {
  preco: 8,
  'fipe-atualizada': 7,
  'vale-a-pena': 6,
  comparativo: 5,
  consumo: 4,
  manutencao: 4,
  problemas: 3,
  seguro: 5,
};

const MELHORES_ANOS = [2020, 2021, 2022, 2023, 2024];

function parseArgs(argv) {
  const args = { limit: 0 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--limit' && argv[i + 1] != null) {
      args.limit = Math.max(0, parseInt(argv[++i], 10) || 0);
    }
  }
  return args;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function anoSlug(ano) {
  const n = Number(ano);
  return n === 0 ? 'zero-km' : String(n);
}

function intentPath(marcaSlug, modeloSlug, ano, intent) {
  return `/${marcaSlug}/${modeloSlug}-${anoSlug(ano)}-${intent}`;
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

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function volumeBuscaScore(modelo, ano) {
  const base = Math.log10(Math.max(modelo.totalVeiculos || 1, 1) + 1) * 10;
  const year = Number(ano);
  let yearBoost = 1;
  if (year === 0) yearBoost = 1.15;
  else if (year >= 2020) yearBoost = 1.2;
  else if (year >= 2015) yearBoost = 1.05;
  else if (year < 2005) yearBoost = 0.85;
  return Math.round(base * yearBoost * 10) / 10;
}

function concorrenciaScore(intent, modelo) {
  const base = INTENT_CONCORRENCIA[intent] ?? 5;
  const pop = clamp(Math.round((modelo.totalVeiculos || 0) / 25), 0, 3);
  return clamp(base + pop, 1, 10);
}

function profundidadeDadosScore(modelo, ano, versoesAno) {
  const pontos = modelo.historico?.pontos?.length || 0;
  const versoes = versoesAno.length;
  const raw = pontos * 0.02 + versoes * 1.5 + (modelo.historico?.valorMedio != null ? 2 : 0);
  return Math.round(clamp(raw, 1, 10) * 10) / 10;
}

function totalScore(volumeBusca, concorrencia, profundidadeDados) {
  const invConc = 11 - concorrencia;
  return Math.round((volumeBusca * 0.45 + invConc * 0.25 + profundidadeDados * 0.3) * 10) / 10;
}

function compactIntentEntry(modelo, ano, intent, scores) {
  return [
    modelo.marcaSlug,
    modelo.modeloSlug,
    Number(ano),
    intent,
    intentPath(modelo.marcaSlug, modelo.modeloSlug, ano, intent),
    scores.volumeBusca,
    scores.concorrencia,
    scores.profundidadeDados,
    scores.totalScore,
  ];
}

function buildMarcaClusters(modelos, marcas) {
  const byMarca = new Map();
  for (const m of modelos) {
    if (!byMarca.has(m.marcaSlug)) {
      byMarca.set(m.marcaSlug, {
        slug: m.marcaSlug,
        nome: m.marcaNome,
        modelos: [],
        totalVeiculos: 0,
        valorSum: 0,
        valorCount: 0,
      });
    }
    const cluster = byMarca.get(m.marcaSlug);
    cluster.modelos.push(m);
    cluster.totalVeiculos += m.totalVeiculos || 0;
    const vm = m.historico?.valorMedio;
    if (typeof vm === 'number') {
      cluster.valorSum += vm;
      cluster.valorCount += 1;
    }
  }

  const marcaMeta = new Map(marcas.map((m) => [m.slug, m]));
  const out = [];

  for (const cluster of byMarca.values()) {
    const sorted = [...cluster.modelos].sort(
      (a, b) => (b.totalVeiculos || 0) - (a.totalVeiculos || 0),
    );
    const topModelos = sorted.slice(0, 8).map((m) => ({
      modeloSlug: m.modeloSlug,
      modeloNome: m.modeloNome,
      totalVeiculos: m.totalVeiculos,
      valorMedio: m.historico?.valorMedio ?? null,
    }));

    const desvalor = [...cluster.modelos]
      .filter((m) => typeof m.historico?.desvalorizacaoPercentual === 'number')
      .sort(
        (a, b) =>
          (b.historico.desvalorizacaoPercentual || 0) -
          (a.historico.desvalorizacaoPercentual || 0),
      )
      .slice(0, 5)
      .map((m) => ({
        modeloSlug: m.modeloSlug,
        modeloNome: m.modeloNome,
        desvalorizacaoPercentual: m.historico.desvalorizacaoPercentual,
        valorMedio: m.historico?.valorMedio ?? null,
      }));

    const valorMedio =
      cluster.valorCount > 0 ? Math.round(cluster.valorSum / cluster.valorCount) : null;
    const meta = marcaMeta.get(cluster.slug);
    const analise = [];

    if (meta) {
      analise.push(
        `${meta.nome} possui ${meta.totalModelos} modelos e ${meta.totalVeiculos} versoes indexadas na FIPE.`,
      );
    } else {
      analise.push(
        `${cluster.nome} possui ${cluster.modelos.length} familias de modelo no indice SEO.`,
      );
    }
    if (topModelos[0]) {
      analise.push(
        `Modelo com maior cobertura: ${topModelos[0].modeloNome} (${topModelos[0].totalVeiculos} versoes).`,
      );
    }
    if (valorMedio != null) {
      analise.push(`Valor medio agregado dos historicos: R$ ${valorMedio.toLocaleString('pt-BR')}.`);
    }
    if (desvalor[0]) {
      analise.push(
        `Maior desvalorizacao registrada: ${desvalor[0].modeloNome} (${desvalor[0].desvalorizacaoPercentual}%).`,
      );
    }
    const comHistorico = cluster.modelos.filter((m) => (m.historico?.pontos?.length || 0) > 0).length;
    analise.push(`${comHistorico} de ${cluster.modelos.length} modelos possuem curva de historico FIPE.`);

    out.push({
      slug: cluster.slug,
      nome: cluster.nome,
      totalVeiculos: meta?.totalVeiculos ?? cluster.totalVeiculos,
      valorMedio,
      topModelos,
      modelosAltaDesvalorizacao: desvalor,
      analise,
    });
  }

  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

function buildDecisaoIndex(intents, comparativos, modelosByKey) {
  const valeAPena = intents
    .filter((row) => row[3] === 'vale-a-pena')
    .sort((a, b) => b[8] - a[8])
    .slice(0, 500)
    .map((row) => {
      const [marcaSlug, modeloSlug, ano, , , score] = row;
      const slug = `vale-a-pena-comprar-${marcaSlug}-${modeloSlug}-${anoSlug(ano)}`;
      return {
        slug,
        url: `/${slug}`,
        marcaSlug,
        modeloSlug,
        ano: Number(ano),
        totalScore: score,
      };
    });

  const comparativosOu = (comparativos.pares || []).map((par) => {
    const slugs = [par.a.modeloSlug, par.b.modeloSlug].sort();
    const slug = `${slugs[0]}-ou-${slugs[1]}`;
    return {
      slug,
      url: `/${slug}`,
      segmento: par.segmento,
      score: par.score,
      a: par.a,
      b: par.b,
    };
  });

  const melhoresSegmento = [];
  for (const segmento of Object.keys(SEGMENTO_RIVAIS)) {
    for (const ano of MELHORES_ANOS) {
      const candidatos = [];
      for (const rival of SEGMENTO_RIVAIS[segmento]) {
        for (const modelo of modelosByKey.values()) {
          if (resolveRivalSlug(modelo.modeloSlug) !== rival) continue;
          const versoesAno = (modelo.versoes || []).filter((v) => Number(v.ano) === ano);
          if (!versoesAno.length) continue;
          const scores = {
            volumeBusca: volumeBuscaScore(modelo, ano),
            concorrencia: concorrenciaScore('vale-a-pena', modelo),
            profundidadeDados: profundidadeDadosScore(modelo, ano, versoesAno),
          };
          scores.totalScore = totalScore(
            scores.volumeBusca,
            scores.concorrencia,
            scores.profundidadeDados,
          );
          candidatos.push({
            marcaSlug: modelo.marcaSlug,
            modeloSlug: modelo.modeloSlug,
            modeloNome: modelo.modeloNome,
            totalScore: scores.totalScore,
            valorMedioAno: Math.round(
              versoesAno.reduce((s, v) => s + (v.valor || 0), 0) / versoesAno.length,
            ),
          });
        }
      }
      candidatos.sort((a, b) => b.totalScore - a.totalScore);
      const top = candidatos.slice(0, 6);
      if (!top.length) continue;
      melhoresSegmento.push({
        slug: `melhores-${segmento}-${ano}`,
        url: `/melhores-${segmento}-${ano}`,
        segmento,
        ano,
        modelos: top,
      });
    }
  }

  return { valeAPena, comparativosOu, melhoresSegmento };
}

function main() {
  const { limit } = parseArgs(process.argv);
  const t0 = Date.now();

  const marcasPath = path.join(SEO_DIR, 'marcas.json');
  const comparativosPath = path.join(SEO_DIR, 'comparativos.json');
  if (!fs.existsSync(MODELOS_DIR)) {
    console.error('Missing', MODELOS_DIR);
    process.exit(1);
  }

  const marcas = fs.existsSync(marcasPath) ? readJson(marcasPath) : [];
  const comparativos = fs.existsSync(comparativosPath)
    ? readJson(comparativosPath)
    : { pares: [] };

  const files = fs
    .readdirSync(MODELOS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const modelos = [];
  const modelosByKey = new Map();
  for (const file of files) {
    try {
      const modelo = readJson(path.join(MODELOS_DIR, file));
      modelos.push(modelo);
      modelosByKey.set(`${modelo.marcaSlug}|${modelo.modeloSlug}`, modelo);
    } catch {
      /* skip invalid */
    }
  }

  const intents = [];
  let urlsPossiveis = 0;

  for (const modelo of modelos) {
    const anos = [
      ...new Set((modelo.versoes || []).map((v) => Number(v.ano)).filter((n) => !Number.isNaN(n))),
    ].sort((a, b) => a - b);
    urlsPossiveis += anos.length * INTENTS.length;

    for (const ano of anos) {
      const versoesAno = (modelo.versoes || []).filter((v) => Number(v.ano) === ano);
      for (const intent of INTENTS) {
        if (limit > 0 && intents.length >= limit) break;
        const scores = {
          volumeBusca: volumeBuscaScore(modelo, ano),
          concorrencia: concorrenciaScore(intent, modelo),
          profundidadeDados: profundidadeDadosScore(modelo, ano, versoesAno),
        };
        scores.totalScore = totalScore(
          scores.volumeBusca,
          scores.concorrencia,
          scores.profundidadeDados,
        );
        intents.push(compactIntentEntry(modelo, ano, intent, scores));
      }
      if (limit > 0 && intents.length >= limit) break;
    }
    if (limit > 0 && intents.length >= limit) break;
  }

  const marcaClusters = buildMarcaClusters(modelos, marcas);
  const decisaoIndex = buildDecisaoIndex(intents, comparativos, modelosByKey);

  const manifest = {
    geradoEm: new Date().toISOString(),
    limit: limit || null,
    counts: {
      modelos: modelos.length,
      intents: intents.length,
      urlsPossiveis,
      marcaClusters: marcaClusters.length,
      decisaoValeAPena: decisaoIndex.valeAPena.length,
      decisaoComparativosOu: decisaoIndex.comparativosOu.length,
      decisaoMelhoresSegmento: decisaoIndex.melhoresSegmento.length,
    },
    schema: {
      intentRow: [
        'marcaSlug',
        'modeloSlug',
        'ano',
        'intent',
        'path',
        'volumeBusca',
        'concorrencia',
        'profundidadeDados',
        'totalScore',
      ],
    },
    paths: {
      intentsIndex: '/data/semantic/intents-index.json',
      marcaClusters: '/data/semantic/marca-clusters.json',
      decisaoIndex: '/data/semantic/decisao-index.json',
    },
  };

  writeJson(path.join(OUT_DIR, 'manifest.json'), manifest);
  writeJson(path.join(OUT_DIR, 'intents-index.json'), intents);
  writeJson(path.join(OUT_DIR, 'marca-clusters.json'), marcaClusters);
  writeJson(path.join(OUT_DIR, 'decisao-index.json'), decisaoIndex);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('Semantic index build complete in', elapsed + 's');
  console.log(JSON.stringify(manifest.counts, null, 2));
}

main();
