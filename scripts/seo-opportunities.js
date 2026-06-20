import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PATHS = {
  manifest: path.join(ROOT, 'public', 'data', 'fipe', 'search', 'manifest.json'),
  srcVeiculos: path.join(ROOT, 'src', 'data', 'fipe', 'veiculos.json'),
  out: path.join(ROOT, 'data', 'reports', 'seo-opportunities.json'),
  reportsRoot: path.join(ROOT, 'data', 'reports'),
};

function main() {
  const manifest = JSON.parse(fs.readFileSync(PATHS.manifest, 'utf-8'));
  const veiculos = JSON.parse(fs.readFileSync(PATHS.srcVeiculos, 'utf-8'));

  const marcas = new Set(veiculos.map((v) => v.marcaSlug ?? v.marca));
  const modelos = new Set(veiculos.map((v) => `${v.marcaSlug ?? v.marca}|${v.modeloSlug ?? v.modelo}`));
  const anos = new Set(veiculos.map((v) => String(v.ano)));
  const versoes = veiculos.length;

  const searchUrls = Number(manifest.total ?? 0);
  const shardUrls = Array.isArray(manifest.shards) ? manifest.shards.length : 0;

  const rotas = {
    marca: marcas.size,
    modelo: modelos.size,
    ano: anos.size,
    historico: versoes,
    fichaTecnica: versoes,
    comparativos: Math.max(0, Math.floor((modelos.size * (modelos.size - 1)) / 2)),
  };

  const estimativaTotal =
    rotas.marca +
    rotas.modelo +
    rotas.ano +
    rotas.historico +
    rotas.fichaTecnica +
    rotas.comparativos +
    searchUrls;

  const report = {
    geradoEm: new Date().toISOString(),
    catalogo: {
      veiculos: veiculos.length,
      marcas: marcas.size,
      modelos: modelos.size,
      anos: anos.size,
    },
    busca: {
      urlsManifest: searchUrls,
      shards: shardUrls,
      path: manifest.path ?? null,
    },
    estimativaUrls: rotas,
    totais: {
      urlsCatalogoAtual: searchUrls + veiculos.length,
      urlsSeoPotencial: estimativaTotal,
    },
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.totais, null, 2));
}

main();
