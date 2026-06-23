/**
 * enrich:raw — valida e cataloga fontes RAW disponiveis localmente.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import type { RawSourceManifest } from '../lib/enrichment/types.js';

function countJsonArray(file: string): number | undefined {
  if (!fs.existsSync(file)) return undefined;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data) ? data.length : undefined;
  } catch {
    return undefined;
  }
}

function countDirJson(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.json')) {
      const rows = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      n += Array.isArray(rows) ? rows.length : 1;
    }
  }
  return n;
}

async function main() {
  const fontes = [
    { id: 'fipex-parquet', path: path.join(PATHS.rawRoot, 'fipex-prices-latest-merged.parquet'), observacao: 'Catalogo FIPE nacional' },
    { id: 'inmetro-pbev', path: path.join(PATHS.rawInmetro, 'pbev-latest.json'), observacao: 'Consumo INMETRO PBEV' },
    { id: 'manufacturers', path: PATHS.rawManufacturers, observacao: 'Fichas tecnicas de fabricantes' },
    { id: 'marketplace', path: path.join(PATHS.rawMarketplace, 'listings-summary.json'), observacao: 'Resumo marketplace (futuro)' },
    { id: 'fipe-catalog', path: PATHS.srcVeiculos, observacao: 'Indice FIPE normalizado em src/' },
    { id: 'fipe-history', path: PATHS.historyRoot, observacao: 'Historico de precos por veiculo' },
  ];

  const manifest: RawSourceManifest = {
    geradoEm: new Date().toISOString(),
    fontes: fontes.map((f) => {
      const presente = fs.existsSync(f.path);
      let registros: number | undefined;
      if (presente) {
        if (f.path.endsWith('.json')) registros = countJsonArray(f.path);
        else if (f.path.endsWith('.parquet')) registros = undefined;
        else if (fs.statSync(f.path).isDirectory()) {
          registros = f.id === 'fipe-history'
            ? fs.readdirSync(f.path).filter((x) => x.endsWith('.json')).length
            : countDirJson(f.path);
        }
      }
      return { id: f.id, path: f.path, presente, registros, observacao: f.observacao };
    }),
  };

  fs.mkdirSync(PATHS.rawRoot, { recursive: true });
  fs.writeFileSync(PATHS.rawManifest, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });