import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DB_PATH = process.env.FIPE_DB_PATH || path.join(ROOT, 'fipe.db');

/** Mapeamentos para bancos com nomenclatura alternativa */
const SCHEMA_ALIASES = {
  marcas: ['marcas', 'brands', 'marca'],
  modelos: ['modelos', 'models', 'modelo'],
  anos: ['anos', 'anos_combustivel', 'model_years', 'model_years', 'veiculos', 'years'],
  precos: ['precos', 'valores_fipe', 'prices', 'valores'],
  tipos: ['tipos', 'types', 'tipo_veiculo'],
};

let dbInstance = null;
let schemaMap = null;

function findTable(candidates, tables) {
  for (const name of candidates) {
    if (tables.includes(name)) return name;
  }
  return null;
}

function getColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function pickColumn(columns, ...options) {
  for (const o of options) {
    if (columns.includes(o)) return o;
  }
  return null;
}

function detectSchema(db) {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map((r) => r.name);

  const marcasTable = findTable(SCHEMA_ALIASES.marcas, tables);
  const modelosTable = findTable(SCHEMA_ALIASES.modelos, tables);
  const anosTable = findTable(SCHEMA_ALIASES.anos, tables);

  if (!marcasTable || !modelosTable) {
    throw new Error(
      `Schema nao reconhecido em ${DB_PATH}. Tabelas encontradas: ${tables.join(', ') || 'nenhuma'}. ` +
        'Execute: npm run db:init',
    );
  }

  const mCols = getColumns(db, marcasTable);
  const modCols = getColumns(db, modelosTable);
  const aCols = anosTable ? getColumns(db, anosTable) : [];

  return {
    tables: { marcas: marcasTable, modelos: modelosTable, anos: anosTable },
    marcas: {
      id: pickColumn(mCols, 'id', 'codigo', 'marca_id') || 'id',
      codigo: pickColumn(mCols, 'codigo', 'code', 'fipe_code', 'valor'),
      nome: pickColumn(mCols, 'nome', 'name', 'marca'),
      tipoId: pickColumn(mCols, 'tipo_id', 'tipo', 'vehicle_type_id'),
    },
    modelos: {
      id: pickColumn(modCols, 'id', 'codigo') || 'id',
      codigo: pickColumn(modCols, 'codigo', 'code', 'fipe_code', 'valor'),
      nome: pickColumn(modCols, 'nome', 'name', 'modelo'),
      marcaId: pickColumn(modCols, 'marca_id', 'brand_id', 'id_marca', 'marca'),
    },
    anos: anosTable
      ? {
          id: pickColumn(aCols, 'id', 'codigo') || 'id',
          codigo: pickColumn(aCols, 'codigo', 'code', 'ano_codigo', 'valor'),
          nome: pickColumn(aCols, 'nome', 'name', 'ano_nome', 'label'),
          ano: pickColumn(aCols, 'ano', 'year', 'ano_modelo'),
          combustivel: pickColumn(aCols, 'combustivel', 'fuel', 'fuel_name', 'combustivel_nome'),
          modeloId: pickColumn(aCols, 'modelo_id', 'model_id', 'id_modelo'),
          codigoFipe: pickColumn(aCols, 'codigo_fipe', 'fipe_code', 'fipe_codigo'),
          valor: pickColumn(aCols, 'valor', 'price', 'price_brl', 'preco', 'valor_fipe'),
          mesReferencia: pickColumn(aCols, 'mes_referencia', 'mes', 'reference_month', 'referencia'),
        }
      : null,
  };
}

export function initDatabase(options = {}) {
  const { readonly = false, createIfMissing = true } = options;
  const exists = fs.existsSync(DB_PATH);

  if (!exists && !createIfMissing) {
    throw new Error(`Banco nao encontrado: ${DB_PATH}`);
  }

  if (!exists) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const temp = new Database(DB_PATH);
    temp.exec(schemaSql);
    temp.close();
  }

  const db = new Database(DB_PATH, { readonly, fileMustExist: true });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  schemaMap = detectSchema(db);
  dbInstance = db;
  return { db, schema: schemaMap, path: DB_PATH };
}

export function getDb() {
  if (!dbInstance) initDatabase();
  return dbInstance;
}

export function getSchema() {
  if (!schemaMap) initDatabase();
  return schemaMap;
}

export function getDbPath() {
  return DB_PATH;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    schemaMap = null;
  }
}
