import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const ROOT = process.cwd();
const files = {
  relatorio: path.join(ROOT, 'data', 'fipe', 'relatorio.json'),
  checkpoint: path.join(ROOT, 'data', 'fipe', 'checkpoint.json'),
  marcas: path.join(ROOT, 'src', 'data', 'fipe', 'marcas.json'),
  modelos: path.join(ROOT, 'src', 'data', 'fipe', 'modelos.json'),
  veiculos: path.join(ROOT, 'src', 'data', 'fipe', 'veiculos.json'),
  searchManifest: path.join(ROOT, 'src', 'data', 'fipe', 'search-index.json'),
  searchShards: path.join(ROOT, 'public', 'api', 'fipe', 'search', 'manifest.json'),
};

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

const cp = readJson(files.checkpoint);
const rel = readJson(files.relatorio);
const marcas = readJson(files.marcas);
const modelos = readJson(files.modelos);
const veiculos = readJson(files.veiculos);
const searchManifest = readJson(files.searchManifest);
const shards = readJson(files.searchShards);

let sqliteStats = null;
try {
  const dbPath = path.join(ROOT, 'fipe.db');
  if (fs.existsSync(dbPath)) {
    const db = new Database(dbPath, { readonly: true });
    sqliteStats = {
      marcas: db.prepare('SELECT COUNT(*) AS n FROM marcas').get().n,
      modelos: db.prepare('SELECT COUNT(*) AS n FROM modelos').get().n,
      anos: db.prepare('SELECT COUNT(*) AS n FROM anos').get().n,
      comPreco: db.prepare('SELECT COUNT(*) AS n FROM anos WHERE valor > 0').get().n,
    };
    db.close();
  }
} catch {
  /* sqlite opcional */
}

console.log('\n=== Status do Catalogo FIPE ===\n');

if (marcas?.length) {
  console.log('Catalogo importado:');
  console.log(`  Marcas:    ${marcas.length}`);
  console.log(`  Modelos:   ${modelos?.length ?? 0}`);
  console.log(`  Veiculos:  ${veiculos?.length ?? 0}`);
} else if (rel?.totais) {
  console.log('Relatorio:', rel.totais);
} else {
  console.log('Catalogo: ainda nao gerado (execute npm run catalog:import)');
}

if (cp) {
  console.log(`\nCheckpoint:`);
  console.log(`  Catalogo completo: ${cp.catalogoCompleto ? 'sim' : 'nao'}`);
  console.log(`  Precos importados: ${cp.precosProcessados?.length ?? 0}`);
  const marcasProc = Object.values(cp.marcasProcessadas ?? {}).flat().length;
  if (!cp.catalogoCompleto && marcasProc) {
    console.log(`  Marcas processadas: ${marcasProc} (retomavel)`);
  }
}

const indexTotal = shards?.total ?? searchManifest?.total ?? 0;
const comPreco = veiculos?.filter((v) => v.valor > 0).length ?? cp?.stats?.comPreco ?? 0;
console.log(`\nBusca indexada: ${indexTotal} itens`);
console.log(`Veiculos com preco: ${comPreco}`);

if (rel?.coberturaEstimada) {
  console.log(`Cobertura estimada: ${rel.coberturaEstimada}`);
}

if (sqliteStats) {
  console.log('\nSQLite (fipe.db):');
  console.log(`  Marcas:   ${sqliteStats.marcas}`);
  console.log(`  Modelos:  ${sqliteStats.modelos}`);
  console.log(`  Anos:     ${sqliteStats.anos}`);
  console.log(`  c/ Preco: ${sqliteStats.comPreco}`);
}

console.log('');
