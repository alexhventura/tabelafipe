import path from 'path';

export const ROOT = process.cwd();

export const PATHS = {
  checkpoint: path.join(ROOT, 'data', 'fipe', 'checkpoint.json'),
  relatorio: path.join(ROOT, 'data', 'fipe', 'relatorio.json'),
  srcMarcas: path.join(ROOT, 'src', 'data', 'fipe', 'marcas.json'),
  srcModelos: path.join(ROOT, 'src', 'data', 'fipe', 'modelos.json'),
  srcVeiculos: path.join(ROOT, 'src', 'data', 'fipe', 'veiculos.json'),
  srcSearchIndex: path.join(ROOT, 'src', 'data', 'fipe', 'search-index.json'),
  publicDataRoot: path.join(ROOT, 'public', 'data', 'fipe'),
  publicMarcas: path.join(ROOT, 'public', 'data', 'fipe', 'marcas.json'),
  publicModelos: path.join(ROOT, 'public', 'data', 'fipe', 'modelos.json'),
  publicSearchDir: path.join(ROOT, 'public', 'data', 'fipe', 'search'),
  publicSearchManifest: path.join(ROOT, 'public', 'data', 'fipe', 'search', 'manifest.json'),
  publicHistoricoRoot: path.join(ROOT, 'public', 'data', 'historico'),
  legacyVeiculos: path.join(ROOT, 'public', 'api', 'fipe', 'veiculos'),
  legacyHistorico: path.join(ROOT, 'public', 'api', 'historico'),
  legacySearchDir: path.join(ROOT, 'public', 'api', 'fipe', 'search'),
} as const;

export function historicoSnapshotDir(month: string): string {
  return path.join(PATHS.publicHistoricoRoot, month);
}
