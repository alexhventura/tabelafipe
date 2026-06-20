import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();

function runNodeScript(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function parseArgs() {
  return { skipHistory: process.argv.includes('--skip-history') };
}

function readCoverageMeta() {
  const file = path.join(ROOT, 'data', 'reports', 'coverage-validation.json');
  if (!fs.existsSync(file)) return { meta99Porcento: false };
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return { meta99Porcento: Boolean(data?.resultados?.meta99Porcento) };
}

function main() {
  const { skipHistory } = parseArgs();

  console.log('Etapa 1/6: audit-data-quality');
  runNodeScript('scripts/audit-data-quality.js');

  console.log('Etapa 2/6: validate-coverage');
  runNodeScript('scripts/validate-coverage.js', ['--sample', '1000', '--seed', '42']);

  const { meta99Porcento } = readCoverageMeta();
  if (!skipHistory && meta99Porcento) {
    console.log('Etapa 3/6: import-history (meta 99% atingida)');
    runNodeScript('scripts/import-history.js', ['--limit', '0', '--force']);
  } else {
    console.log('Etapa 3/6: import-history ignorado (meta99=' + meta99Porcento + ', skipHistory=' + skipHistory + ')');
  }

  console.log('Etapa 4/6: seo-opportunities');
  runNodeScript('scripts/seo-opportunities.js');

  console.log('Etapa 5/6: analyze-performance');
  runNodeScript('scripts/analyze-performance.js');

  console.log('Etapa 6/6: executive-report');
  runNodeScript('scripts/executive-report.js');

  console.log('Fase 2 concluida.');
}

main();
