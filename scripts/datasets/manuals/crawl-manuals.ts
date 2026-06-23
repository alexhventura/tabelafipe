/**
 * Skeleton: crawl de manuais do proprietario -> manual_specs.json
 */
import fs from 'fs';
import { PATHS } from '../../lib/fipe-paths.js';

async function main() {
  fs.mkdirSync(PATHS.rawManuals, { recursive: true });
  const out = {
    geradoEm: new Date().toISOString(),
    fonte: 'skeleton',
    registros: [] as { marca: string; modelo: string; url: string }[],
    nota: 'Implementar crawl de manuais OEM e extracao de specs.',
  };
  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(PATHS.manualSpecs, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ registros: out.registros.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});