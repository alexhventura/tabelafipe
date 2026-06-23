/**
 * Valida JSONs em data/raw/manufacturers/ e gera relatorio de cobertura por marca.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../../lib/fipe-paths.js';

async function main() {
  const catalog = JSON.parse(fs.readFileSync(PATHS.manufacturersCatalog, 'utf-8')) as { marcas: { slug: string; nome: string }[] };
  const dir = PATHS.rawManufacturers;
  fs.mkdirSync(dir, { recursive: true });

  const porMarca: Record<string, { registros: number; campos: Record<string, number> }> = {};
  for (const m of catalog.marcas) {
    const file = path.join(dir, `${m.slug}.json`);
    if (!fs.existsSync(file)) { porMarca[m.nome] = { registros: 0, campos: {} }; continue; }
    const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>[];
    const campos: Record<string, number> = {};
    for (const r of rows) {
      for (const [k, v] of Object.entries(r)) {
        if (v != null && v !== '') campos[k] = (campos[k] ?? 0) + 1;
      }
    }
    porMarca[m.nome] = { registros: rows.length, campos };
  }

  const report = { geradoEm: new Date().toISOString(), porMarca, totalRegistros: Object.values(porMarca).reduce((s, x) => s + x.registros, 0) };
  fs.writeFileSync(PATHS.manufacturersCoverageReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });