/**
 * Scale report for semantic intent index.
 * Usage: node scripts/semantic-scale-report.js
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SEM_DIR = path.join(ROOT, 'public', 'data', 'semantic');
const OUT = path.join(ROOT, 'data', 'reports', 'semantic-scale-report.json');

function readJson(p, fallback = null) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function main() {
  const manifest = readJson(path.join(SEM_DIR, 'manifest.json'), { counts: {} });
  const intents = readJson(path.join(SEM_DIR, 'intents-index.json'), []);
  const clusters = readJson(path.join(SEM_DIR, 'marca-clusters.json'), []);
  const decisao = readJson(path.join(SEM_DIR, 'decisao-index.json'), {});

  const urlsPossiveis = manifest.counts?.urlsPossiveis || 0;
  const urlsGeradas = manifest.counts?.intents || intents.length || 0;

  const intentTrafficWeight = {
    preco: 1.2,
    'fipe-atualizada': 1.1,
    'vale-a-pena': 1.15,
    comparativo: 1.05,
    consumo: 0.9,
    manutencao: 0.85,
    problemas: 0.95,
    seguro: 0.88,
  };

  let projecaoTrafego = 0;
  for (const row of intents) {
    const intent = row[3];
    const score = row[8] || 0;
    const w = intentTrafficWeight[intent] ?? 1;
    projecaoTrafego += score * w;
  }
  projecaoTrafego = Math.round(projecaoTrafego);

  const clustersFortes = [...clusters]
    .map((c) => ({
      slug: c.slug,
      nome: c.nome,
      totalVeiculos: c.totalVeiculos,
      modelos: c.topModelos?.length || 0,
      score: (c.topModelos?.[0]?.totalVeiculos || 0) + (c.valorMedio ? c.valorMedio / 10000 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const profundidadeByIntent = new Map();
  for (const row of intents) {
    const intent = row[3];
    const prof = row[7] || 0;
    const cur = profundidadeByIntent.get(intent) || { sum: 0, n: 0 };
    cur.sum += prof;
    cur.n += 1;
    profundidadeByIntent.set(intent, cur);
  }

  const gapsConteudo = [...profundidadeByIntent.entries()]
    .map(([intent, { sum, n }]) => ({
      intent,
      profundidadeMedia: n ? Math.round((sum / n) * 100) / 100 : 0,
      paginas: n,
    }))
    .sort((a, b) => a.profundidadeMedia - b.profundidadeMedia);

  const lowDataMarcas = clusters
    .filter((c) => {
      const avgProf =
        c.topModelos?.reduce((s, m) => s + (m.totalVeiculos || 0), 0) /
        Math.max(c.topModelos?.length || 1, 1);
      return avgProf < 5;
    })
    .slice(0, 10)
    .map((c) => ({ slug: c.slug, nome: c.nome, totalVeiculos: c.totalVeiculos }));

  const rankingPrioridade = intents
    .map((row) => ({
      path: row[4],
      marcaSlug: row[0],
      modeloSlug: row[1],
      ano: row[2],
      intent: row[3],
      totalScore: row[8],
      volumeBusca: row[5],
      profundidadeDados: row[7],
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);

  const report = {
    geradoEm: new Date().toISOString(),
    urlsPossiveis,
    urlsGeradas,
    coberturaPercentual:
      urlsPossiveis > 0 ? Math.round((urlsGeradas / urlsPossiveis) * 10000) / 100 : null,
    projecaoTrafego,
    clustersFortes,
    gapsConteudo,
    gapsMarcasBaixaCobertura: lowDataMarcas,
    decisaoCounts: {
      valeAPena: decisao.valeAPena?.length || 0,
      comparativosOu: decisao.comparativosOu?.length || 0,
      melhoresSegmento: decisao.melhoresSegmento?.length || 0,
    },
    rankingPrioridade,
    fontes: {
      semanticManifest: fs.existsSync(path.join(SEM_DIR, 'manifest.json')),
      intentsIndex: fs.existsSync(path.join(SEM_DIR, 'intents-index.json')),
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf-8');

  console.log(
    JSON.stringify(
      {
        urlsPossiveis: report.urlsPossiveis,
        urlsGeradas: report.urlsGeradas,
        coberturaPercentual: report.coberturaPercentual,
        projecaoTrafego: report.projecaoTrafego,
        topPrioridade: report.rankingPrioridade.slice(0, 5),
      },
      null,
      2,
    ),
  );
}

main();
