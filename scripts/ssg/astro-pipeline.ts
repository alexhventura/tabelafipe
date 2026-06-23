import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const phase1 = args.includes('--phase1');

if (phase1) {
  process.env.SSG_LIMIT_VEHICLES = '100';
  process.env.SSG_LIMIT_FAMILIES = '100';
  process.env.SSG_LIMIT_GENERATIONS = '50';
  process.env.SSG_LIMIT_ENGINES = '5';
  process.env.SSG_LIMIT_PLATFORMS = '6';
}

function run(script: string): void {
  const r = spawnSync('npx', ['tsx', script, ...(phase1 ? ['--phase1'] : [])], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('scripts/ssg/run-astro-build.ts');
run('scripts/ssg/generate-astro-sitemaps.ts');
run('scripts/ssg/astro-build-audit.ts');
