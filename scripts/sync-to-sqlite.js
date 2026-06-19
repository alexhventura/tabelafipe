/**
 * Sincroniza JSON do catalogo (src/data/fipe) para fipe.db
 * Ponte hibrida: importacao API/JSON -> SQLite -> API Express + busca estatica
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const DB_PATH = process.env.FIPE_DB_PATH || path.join(ROOT, "fipe.db");
const SRC = path.join(ROOT, "src", "data", "fipe");

const TIPO_MAP = { carros: 1, motos: 2, caminhoes: 3 };

function load(name) {
  const p = path.join(SRC, name);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const schema = fs.readFileSync(path.join(ROOT, "server", "db", "schema.sql"), "utf-8");
const db = new Database(DB_PATH);
db.exec(schema);
db.pragma("journal_mode = WAL");

const upsertMarca = db.prepare(`
  INSERT INTO marcas (tipo_id, codigo, nome) VALUES (?, ?, ?)
  ON CONFLICT(tipo_id, codigo) DO UPDATE SET nome = excluded.nome
`);
const getMarcaId = db.prepare("SELECT id FROM marcas WHERE tipo_id = ? AND codigo = ?");

const upsertModelo = db.prepare(`
  INSERT INTO modelos (marca_id, codigo, nome) VALUES (?, ?, ?)
  ON CONFLICT(marca_id, codigo) DO UPDATE SET nome = excluded.nome
`);
const getModeloId = db.prepare("SELECT id FROM modelos WHERE marca_id = ? AND codigo = ?");

const upsertAno = db.prepare(`
  INSERT INTO anos (modelo_id, codigo, nome, ano, combustivel, codigo_fipe, valor, mes_referencia)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(modelo_id, codigo) DO UPDATE SET
    nome = excluded.nome,
    ano = excluded.ano,
    combustivel = excluded.combustivel,
    codigo_fipe = excluded.codigo_fipe,
    valor = excluded.valor,
    mes_referencia = excluded.mes_referencia
`);

const tx = db.transaction(() => {
  const marcas = load("marcas.json");
  const modelos = load("modelos.json");
  const veiculos = load("veiculos.json");

  for (const m of marcas) {
    const tipoId = TIPO_MAP[m.tipo] || 1;
    upsertMarca.run(tipoId, m.codigo, m.nome);
  }

  for (const m of modelos) {
    const tipoId = TIPO_MAP[m.tipo] || 1;
    const marcaRow = getMarcaId.get(tipoId, m.marcaCodigo);
    if (!marcaRow) continue;
    upsertModelo.run(marcaRow.id, m.codigo, m.nome);
  }

  for (const v of veiculos) {
    const tipoId = TIPO_MAP[v.tipo] || 1;
    const marcaRow = getMarcaId.get(tipoId, v.marcaCodigo);
    if (!marcaRow) continue;
    const modeloRow = getModeloId.get(marcaRow.id, v.modeloCodigo);
    if (!modeloRow) continue;
    upsertAno.run(
      modeloRow.id,
      v.anoCodigo,
      v.anoNome || String(v.ano),
      v.ano || null,
      v.combustivel || null,
      v.fipeCodigo || null,
      v.valor || null,
      v.mesReferencia || null,
    );
  }
});

tx();

const stats = {
  marcas: db.prepare("SELECT COUNT(*) AS n FROM marcas").get().n,
  modelos: db.prepare("SELECT COUNT(*) AS n FROM modelos").get().n,
  anos: db.prepare("SELECT COUNT(*) AS n FROM anos").get().n,
  comPreco: db.prepare("SELECT COUNT(*) AS n FROM anos WHERE valor > 0").get().n,
};

console.log("SQLite sincronizado:", DB_PATH);
console.log(stats);
db.close();