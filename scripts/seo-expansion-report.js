/**
 * SEO expansion report from built indexes and current sitemap/search manifest.
 * Usage: node scripts/seo-expansion-report.js
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'reports', 'seo-expansion-report.json');
const SEO_MANIFEST = path.join(ROOT, 'public', 'data', 'seo', 'manifest.json');
const SEARCH_MANIFEST = path.join(ROOT, 'public', 'data', 'fipe', 'search', 'manifest.json');
const SITEMAP = path.join(ROOT, 'public', 'sitemap.xml');

function readJson(p, fallback = null) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function countSitemapUrls() {
  const publicDir = path.join(ROOT, 'public');
  let total = 0;
  const names = fs.readdirSync(publicDir).filter((n) => n.startsWith('sitemap-') && n.endsWith('.xml'));
  for (const name of names) {
    const file = path.join(publicDir, name);
    const xml = fs.readFileSync(file, 'utf-8');
    total += (xml.match(/<loc>/g) || []).length;
  }
  if (total > 0) return total;
  if (!fs.existsSync(SITEMAP)) return 0;
  const xml = fs.readFileSync(SITEMAP, 'utf-8');
  if (xml.includes('<sitemapindex')) return 0;
  return (xml.match(/<loc>/g) || []).length;
}

function scoreRoute({ traffic, compute, indexEase }) {
  return traffic + compute + indexEase;
}

function main() {
  const seo = readJson(SEO_MANIFEST, { counts: {} });
  const search = readJson(SEARCH_MANIFEST, { total: 0 });
  const sitemapUrls = countSitemapUrls();

  const urlsAtuais = sitemapUrls || Number(search.total || 0) + 1;
  const urlsAposExpansao = urlsAtuais;
  const estimativaPaginasIndexaveis = urlsAposExpansao;
  const estimativaCrescimentoOrganico =
    urlsAtuais > 0
      ? Math.round(((urlsAposExpansao - urlsAtuais) / urlsAtuais) * 10000) / 100
      : null;

  const oportunidades = [
    {
      id: 'paginas-marca',
      titulo: 'Landing pages por marca',
      paginasEstimadas: seo.counts?.marcas || 0,
      descricao: 'Listagens FIPE agregadas por fabricante com modelos e volumes.',
    },
    {
      id: 'paginas-modelo',
      titulo: 'Paginas de modelo com historico agregado',
      paginasEstimadas: seo.counts?.modelosGerados || seo.counts?.modelosTotal || 0,
      descricao: 'Detalhe por familia de modelo com versoes, anos e curva de preco media.',
    },
    {
      id: 'paginas-ano',
      titulo: 'Hubs por ano-modelo',
      paginasEstimadas: seo.counts?.anos || 0,
      descricao: 'Paginas por ano com top veiculos e cobertura de marcas/modelos.',
    },
    {
      id: 'comparativos-segmento',
      titulo: 'Comparativos entre rivais de segmento',
      paginasEstimadas: seo.counts?.comparativos || 0,
      descricao: 'Pares curados (ex: civic-vs-corolla) com dados FIPE lado a lado.',
    },
    {
      id: 'historico-veiculo',
      titulo: 'Historico individual ja indexavel',
      paginasEstimadas: seo.counts?.veiculos || Number(search.total || 0),
      descricao: 'Expandir internal linking a partir das paginas de veiculo existentes.',
    },
  ];

  const rankingPriorizacao = [
    {
      rota: 'comparativos-segmento',
      trafficPotential: 9,
      computeCost: 9,
      indexEase: 10,
      totalScore: scoreRoute({ traffic: 9, compute: 9, indexEase: 10 }),
      paginas: seo.counts?.comparativos || 0,
    },
    {
      rota: 'paginas-modelo',
      trafficPotential: 10,
      computeCost: 6,
      indexEase: 8,
      totalScore: scoreRoute({ traffic: 10, compute: 6, indexEase: 8 }),
      paginas: seo.counts?.modelosGerados || seo.counts?.modelosTotal || 0,
    },
    {
      rota: 'paginas-marca',
      trafficPotential: 8,
      computeCost: 9,
      indexEase: 9,
      totalScore: scoreRoute({ traffic: 8, compute: 9, indexEase: 9 }),
      paginas: seo.counts?.marcas || 0,
    },
    {
      rota: 'paginas-ano',
      trafficPotential: 7,
      computeCost: 9,
      indexEase: 8,
      totalScore: scoreRoute({ traffic: 7, compute: 9, indexEase: 8 }),
      paginas: seo.counts?.anos || 0,
    },
    {
      rota: 'historico-veiculo',
      trafficPotential: 6,
      computeCost: 4,
      indexEase: 7,
      totalScore: scoreRoute({ traffic: 6, compute: 4, indexEase: 7 }),
      paginas: seo.counts?.veiculos || Number(search.total || 0),
    },
  ].sort((a, b) => b.totalScore - a.totalScore);

  const report = {
    geradoEm: new Date().toISOString(),
    urlsAtuais,
    urlsAposExpansao,
    estimativaPaginasIndexaveis,
    estimativaCrescimentoOrganico,
    oportunidades,
    rankingPriorizacao,
    fontes: {
      seoManifest: fs.existsSync(SEO_MANIFEST),
      searchManifest: fs.existsSync(SEARCH_MANIFEST),
      sitemap: fs.existsSync(SITEMAP),
    },
    seoCounts: seo.counts || {},
    implementacao: {
      rotasAtivas: [
        '/marca/:marcaSlug',
        '/modelo/:marcaSlug/:modeloSlug',
        '/historico/:marcaSlug/:modeloSlug',
        '/comparar/:slug',
        '/ano/:year',
      ],
      sitemapIndex: fs.existsSync(SITEMAP) && fs.readFileSync(SITEMAP, 'utf-8').includes('<sitemapindex'),
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify({
    urlsAtuais,
    urlsAposExpansao,
    estimativaCrescimentoOrganico,
    top5: rankingPriorizacao.slice(0, 5).map((r) => ({ rota: r.rota, totalScore: r.totalScore })),
  }, null, 2));
}

main();