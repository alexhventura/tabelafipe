import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PATHS = {
  publicFipe: path.join(ROOT, 'public', 'data', 'fipe'),
  srcFipe: path.join(ROOT, 'src', 'data', 'fipe'),
  history: path.join(ROOT, 'data', 'history'),
  manifest: path.join(ROOT, 'public', 'data', 'fipe', 'search', 'manifest.json'),
  srcVeiculos: path.join(ROOT, 'src', 'data', 'fipe', 'veiculos.json'),
  out: path.join(ROOT, 'data', 'reports', 'performance-report.json'),
  reportsRoot: path.join(ROOT, 'data', 'reports'),
};

function dirStats(root) {
  let bytes = 0;
  let files = 0;
  if (!fs.existsSync(root)) return { bytes, files, megabytes: 0 };

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) {
        bytes += fs.statSync(full).size;
        files += 1;
      }
    }
  };

  walk(root);
  return { bytes, files, megabytes: Math.round((bytes / (1024 * 1024)) * 100) / 100 };
}

function timed(fn) {
  const start = performance.now();
  const value = fn();
  return { ms: Math.round((performance.now() - start) * 100) / 100, value };
}

function main() {
  const veiculosLoad = timed(() => JSON.parse(fs.readFileSync(PATHS.srcVeiculos, 'utf-8')));
  const manifest = JSON.parse(fs.readFileSync(PATHS.manifest, 'utf-8'));
  const searchDir = path.join(PATHS.publicFipe, 'search');

  const shardLoads = (manifest.shards ?? []).map((shard) => {
    const file = path.join(searchDir, `shard-${shard}.json`);
    if (!fs.existsSync(file)) return { shard, ms: 0, registros: null, missing: true };
    const result = timed(() => JSON.parse(fs.readFileSync(file, 'utf-8')));
    return { shard, ms: result.ms, registros: Array.isArray(result.value) ? result.value.length : null };
  });

  const report = {
    geradoEm: new Date().toISOString(),
    tamanhos: {
      publicDataFipe: dirStats(PATHS.publicFipe),
      srcDataFipe: dirStats(PATHS.srcFipe),
      dataHistory: dirStats(PATHS.history),
    },
    cargas: {
      veiculosJson: {
        ms: veiculosLoad.ms,
        registros: veiculosLoad.value.length,
        bytes: fs.statSync(PATHS.srcVeiculos).size,
      },
      searchShards: {
        totalShards: shardLoads.length,
        tempoTotalMs: Math.round(shardLoads.reduce((s, x) => s + x.ms, 0) * 100) / 100,
        shards: shardLoads,
      },
    },
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.cargas, null, 2));
}

main();
