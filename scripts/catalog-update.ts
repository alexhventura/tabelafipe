/**
 * Pipeline completo automatizado — catalog:update
 */
import { spawnSync } from 'child_process';

const steps = [
  ['FIPE precos', 'npm', ['run', 'catalog:prices']],
  ['INMETRO discover', 'npm', ['run', 'datasets:inmetro:discover']],
  ['INMETRO download', 'npx', ['tsx', 'scripts/datasets/inmetro/download-pbev.ts']],
  ['INMETRO extract+normalize', 'npm', ['run', 'datasets:inmetro:extract'], '&&', 'npm', ['run', 'datasets:inmetro:normalize']],
  ['Fabricantes crawl', 'npx', ['tsx', 'scripts/datasets/manufacturers/crawl-manufacturers.ts']],
  ['Latin NCAP', 'npx', ['tsx', 'scripts/datasets/safety/fetch-latin-ncap.ts']],
  ['Recalls', 'npx', ['tsx', 'scripts/datasets/recalls/fetch-recalls.ts']],
  ['Garantia', 'npx', ['tsx', 'scripts/datasets/warranty/extract-warranty.ts']],
  ['Normalize', 'npm', ['run', 'enrich:normalize']],
  ['Build specs', 'npm', ['run', 'datasets:build-specs']],
  ['Enrich', 'npm', ['run', 'enrich:vehicles']],
  ['Generated', 'npm', ['run', 'enrich:build']],
  ['Search FIPE', 'npm', ['run', 'catalog:search']],
  ['Vehicle search index', 'npm', ['run', 'datasets:search-index']],
  ['Coverage audit', 'npm', ['run', 'datasets:coverage-audit']],
  ['Matching report', 'npm', ['run', 'datasets:matching']],
  ['Dashboard', 'npm', ['run', 'datasets:dashboard']],
];

function run(label: string, cmd: string, args: string[]) {
  console.log('\n>> ' + label);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) console.warn('Aviso: etapa falhou:', label);
}

async function main() {
  const start = Date.now();
  run('FIPE precos', 'npm', ['run', 'catalog:prices']);
  run('INMETRO discover', 'npm', ['run', 'datasets:inmetro:discover']);
  run('INMETRO download', 'npx', ['tsx', 'scripts/datasets/inmetro/download-pbev.ts']);
  run('INMETRO extract', 'npm', ['run', 'datasets:inmetro:extract']);
  run('INMETRO normalize', 'npm', ['run', 'datasets:inmetro:normalize']);
  run('Document library + graphs + OEM', 'npm', ['run', 'datasets:pipeline:automotive']);
  run('Generations catalog', 'npm', ['run', 'datasets:generations:build']);
  run('Vehicle relations', 'npm', ['run', 'datasets:vehicle-relations']);
  run('Latin NCAP', 'npx', ['tsx', 'scripts/datasets/safety/fetch-latin-ncap.ts']);
  run('Recalls', 'npx', ['tsx', 'scripts/datasets/recalls/fetch-recalls.ts']);
  run('Garantia', 'npx', ['tsx', 'scripts/datasets/warranty/extract-warranty.ts']);
  run('Normalize vehicles', 'npm', ['run', 'enrich:normalize']);
  run('Build static specs', 'npm', ['run', 'datasets:build-specs']);
  run('Enrich vehicles', 'npm', ['run', 'enrich:vehicles']);
  run('Build generated', 'npm', ['run', 'enrich:build']);
  run('FIPE search', 'npm', ['run', 'catalog:search']);
  run('Vehicle search index', 'npm', ['run', 'datasets:search-index']);
  run('Coverage audit', 'npm', ['run', 'datasets:coverage-audit']);
  run('Matching', 'npm', ['run', 'datasets:matching']);
  run('Dashboard', 'npm', ['run', 'datasets:dashboard']);
  console.log('\nPipeline concluido em', Math.round((Date.now() - start) / 1000), 's');
}
main().catch(e => { console.error(e); process.exit(1); });