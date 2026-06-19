/**
 * Atualizador mensal: API -> JSON estatico -> historico -> shards -> sitemap.
 * Producao nunca chama API.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PATHS, historicoSnapshotDir } from './lib/fipe-paths.js';

function run(label: string, cmd: string, args: string[]) {
  console.log(`\n>> ${label}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function snapshotHistorico(month: string) {
  const dest = historicoSnapshotDir(month);
  if (!fs.existsSync(PATHS.publicDataRoot)) return;

  fs.mkdirSync(dest, { recursive: true });

  const entries: { codigo: string; valor: number; dataPath: string }[] = [];

  function walk(dir: string) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else if (name.name.endsWith('.json') && !full.includes(`${path.sep}search${path.sep}`)) {
        const raw = JSON.parse(fs.readFileSync(full, 'utf-8'));
        const valor = Number(raw.valor ?? raw.valorAtual ?? 0);
        if (!valor) continue;
        const rel = path.relative(PATHS.publicDataRoot, full).replace(/\\/g, '/');
        entries.push({
          codigo: String(raw.codigoFipe || raw.fipeCodigo || raw.id || rel),
          valor,
          dataPath: `/data/fipe/${rel}`,
        });
      }
    }
  }

  walk(PATHS.publicDataRoot);

  const manifest = {
    mes: month,
    geradoEm: new Date().toISOString(),
    total: entries.length,
  };

  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dest, 'precos.json'), JSON.stringify(entries));
  console.log(`Snapshot historico: ${entries.length} precos em ${dest}`);
}

function main() {
  const month = monthKey();
  console.log('=== Atualizacao mensal FIPE ===');
  console.log(`Referencia: ${month}`);

  run('Catalogo (estrutura)', 'npx', ['tsx', 'scripts/import-fipe.ts', '--fase', 'catalogo']);
  run('Precos', 'npx', ['tsx', 'scripts/import-fipe.ts', '--fase', 'precos']);
  run('Indice de busca', 'npx', ['tsx', 'scripts/build-search-index.ts']);
  snapshotHistorico(month);
  run('Sitemap', 'node', ['scripts/generate-sitemap.js']);

  console.log('\nAtualizacao mensal concluida.');
}

main();
