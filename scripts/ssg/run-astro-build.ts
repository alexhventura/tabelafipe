import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ASTRO_DIR = path.join(ROOT, 'astro-ssg');
const DIST = path.join(ASTRO_DIR, 'dist');

if (process.argv.includes('--phase1')) {
  process.env.SSG_LIMIT_VEHICLES = '100';
  process.env.SSG_LIMIT_FAMILIES = '100';
  process.env.SSG_LIMIT_GENERATIONS = '50';
  process.env.SSG_LIMIT_ENGINES = '5';
  process.env.SSG_LIMIT_PLATFORMS = '6';
}

const startMem = process.memoryUsage().rss;
const t0 = Date.now();

const build = spawnSync('npm', ['run', 'build'], {
  cwd: ASTRO_DIR,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

if (build.status !== 0) process.exit(build.status ?? 1);

const buildTimeMs = Date.now() - t0;
const endMem = process.memoryUsage().rss;
const meta = {
  buildTimeMs,
  memoryMb: Math.round(Math.max(startMem, endMem) / 1024 / 1024),
  finishedAt: new Date().toISOString(),
};

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, '.build-meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
console.log(JSON.stringify({ phase: 'astro-build', ...meta }));
