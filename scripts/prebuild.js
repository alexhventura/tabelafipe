/**
 * Pre-build: garante indice de busca antes do vite build.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MANIFEST = path.join(process.cwd(), 'public', 'data', 'fipe', 'search', 'manifest.json');
const LEGACY_MANIFEST = path.join(process.cwd(), 'public', 'api', 'fipe', 'search', 'manifest.json');
const VEICULOS = path.join(process.cwd(), 'src', 'data', 'fipe', 'veiculos.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function readTotal(file) {
  if (!fs.existsSync(file)) return 0;
  return JSON.parse(fs.readFileSync(file, 'utf-8')).total || 0;
}

let total = readTotal(MANIFEST);
if (total < 50) total = readTotal(LEGACY_MANIFEST);

if (total < 50) {
  console.log('Pre-build: bootstrap do catalogo...');
  run('npx', ['tsx', 'scripts/bootstrap-catalog.js']);
}

if (!fs.existsSync(path.join(process.cwd(), 'public', 'data', 'fipe'))) {
  console.log('Pre-build: migrando arvore estatica...');
  run('npx', ['tsx', 'scripts/migrate-flat-to-tree.ts']);
}

if (fs.existsSync(VEICULOS)) {
  const n = JSON.parse(fs.readFileSync(VEICULOS, 'utf-8')).length;
  if (n > 0) {
    console.log(`Pre-build: rebuild search index (${n} veiculos)...`);
    run('npx', ['tsx', 'scripts/build-search-index.ts']);
  }
}

console.log('Pre-build: sitemap...');
run('node', ['scripts/generate-sitemap.js']);
