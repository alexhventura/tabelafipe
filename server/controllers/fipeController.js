import { getDb, getSchema } from '../db/fipeDb.js';

function parseIntParam(value, name) {
  const n = parseInt(String(value), 10);
  if (!value || isNaN(n) || n <= 0) {
    const err = new Error(`Parametro invalido: ${name}`);
    err.status = 400;
    throw err;
  }
  return n;
}

function ok(res, data) {
  res.json({ ok: true, data });
}

function fail(res, err) {
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: err.message || 'Erro interno',
  });
}

/**
 * GET /api/fipe/marcas?tipo=carros|motos|caminhoes
 */
export function listMarcas(req, res) {
  try {
    const db = getDb();
    const schema = getSchema();
    const t = schema.tables;
    const cols = schema.marcas;
    const tipo = req.query.tipo;

    let sql = `SELECT m.${cols.id} AS id, m.${cols.codigo} AS codigo, m.${cols.nome} AS nome`;
    const params = [];
    if (cols.tipoId) {
      sql += `, t.codigo AS tipo FROM ${t.marcas} m JOIN tipos t ON t.id = m.${cols.tipoId}`;
      if (tipo) {
        sql += ' WHERE t.codigo = ?';
        params.push(tipo);
      }
    } else {
      sql += ` FROM ${t.marcas} m`;
    }
    sql += ` ORDER BY m.${cols.nome} COLLATE NOCASE`;

    const rows = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();

    ok(res, rows);
  } catch (err) {
    fail(res, err);
  }
}

/**
 * GET /api/fipe/modelos?marcaId=X
 */
export function listModelos(req, res) {
  try {
    const marcaId = parseIntParam(req.query.marcaId, 'marcaId');
    const db = getDb();
    const { tables, modelos: cols } = getSchema();

    const rows = db
      .prepare(
        `SELECT id, ${cols.codigo} AS codigo, ${cols.nome} AS nome, ${cols.marcaId} AS marcaId
         FROM ${tables.modelos}
         WHERE ${cols.marcaId} = ?
         ORDER BY ${cols.nome} COLLATE NOCASE`,
      )
      .all(marcaId);

    ok(res, rows);
  } catch (err) {
    fail(res, err);
  }
}

/**
 * GET /api/fipe/anos?marcaId=X&modeloId=Y
 */
export function listAnos(req, res) {
  try {
    const marcaId = parseIntParam(req.query.marcaId, 'marcaId');
    const modeloId = parseIntParam(req.query.modeloId, 'modeloId');
    const db = getDb();
    const { tables, modelos: mCols, anos: aCols } = getSchema();

    if (!tables.anos || !aCols) {
      const err = new Error('Tabela de anos nao encontrada no banco');
      err.status = 500;
      throw err;
    }

    const modelo = db
      .prepare(`SELECT id FROM ${tables.modelos} WHERE id = ? AND ${mCols.marcaId} = ?`)
      .get(modeloId, marcaId);

    if (!modelo) {
      const err = new Error('Modelo nao pertence a marca informada');
      err.status = 404;
      throw err;
    }

    const rows = db
      .prepare(
        `SELECT id,
                ${aCols.codigo} AS codigo,
                ${aCols.nome} AS nome,
                ${aCols.ano} AS ano,
                ${aCols.combustivel} AS combustivel
         FROM ${tables.anos}
         WHERE ${aCols.modeloId} = ?
         ORDER BY ${aCols.ano} DESC, ${aCols.nome} COLLATE NOCASE`,
      )
      .all(modeloId);

    ok(res, rows);
  } catch (err) {
    fail(res, err);
  }
}

/**
 * GET /api/fipe/preco?marcaId=X&modeloId=Y&anoId=Z
 */
export function getPreco(req, res) {
  try {
    const marcaId = parseIntParam(req.query.marcaId, 'marcaId');
    const modeloId = parseIntParam(req.query.modeloId, 'modeloId');
    const anoId = parseIntParam(req.query.anoId, 'anoId');

    const db = getDb();
    const { tables, marcas: maCols, modelos: mCols, anos: aCols } = getSchema();

    const row = db
      .prepare(
        `SELECT
           ma.${maCols.nome} AS marca,
           mo.${mCols.nome} AS modelo,
           a.${aCols.nome} AS anoNome,
           a.${aCols.ano} AS ano,
           a.${aCols.combustivel} AS combustivel,
           a.${aCols.codigoFipe} AS codigoFipe,
           a.${aCols.valor} AS valor,
           a.${aCols.mesReferencia} AS mesReferencia,
           a.id AS anoId,
           mo.id AS modeloId,
           ma.${maCols.id} AS marcaId
         FROM ${tables.anos} a
         JOIN ${tables.modelos} mo ON mo.id = a.${aCols.modeloId}
         JOIN ${tables.marcas} ma ON ma.${maCols.id} = mo.${mCols.marcaId}
         WHERE a.id = ? AND mo.id = ? AND ma.${maCols.id} = ?`,
      )
      .get(anoId, modeloId, marcaId);

    if (!row) {
      const err = new Error('Registro nao encontrado');
      err.status = 404;
      throw err;
    }

    ok(res, {
      marca: row.marca,
      modelo: row.modelo,
      ano: row.ano,
      anoNome: row.anoNome,
      combustivel: row.combustivel,
      codigoFipe: row.codigoFipe,
      valor: row.valor,
      valorFormatado: row.valor
        ? `R$ ${Number(row.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : null,
      mesReferencia: row.mesReferencia,
      marcaId: row.marcaId,
      modeloId: row.modeloId,
      anoId: row.anoId,
    });
  } catch (err) {
    fail(res, err);
  }
}

/**
 * GET /api/fipe/stats — estatisticas do banco (hibrido / monitoramento)
 */
export function getStats(req, res) {
  try {
    const db = getDb();
    const { tables } = getSchema();

    const marcas = db.prepare(`SELECT COUNT(*) AS n FROM ${tables.marcas}`).get().n;
    const modelos = db.prepare(`SELECT COUNT(*) AS n FROM ${tables.modelos}`).get().n;
    const anos = tables.anos
      ? db.prepare(`SELECT COUNT(*) AS n FROM ${tables.anos}`).get().n
      : 0;
    const comPreco = tables.anos
      ? db
          .prepare(`SELECT COUNT(*) AS n FROM ${tables.anos} WHERE valor IS NOT NULL AND valor > 0`)
          .get().n
      : 0;

    ok(res, { marcas, modelos, anos, comPreco, coberturaPreco: anos ? `${Math.round((comPreco / anos) * 100)}%` : '0%' });
  } catch (err) {
    fail(res, err);
  }
}

/**
 * GET /api/fipe/busca?q=termo&tipo=carros&limit=20
 * Busca textual local no SQLite (complementa JSON estatico)
 */
export function buscaLocal(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      const err = new Error('Parametro q deve ter ao menos 2 caracteres');
      err.status = 400;
      throw err;
    }
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
    const tipo = req.query.tipo;

    const db = getDb();
    const { tables, marcas: maCols, modelos: mCols, anos: aCols } = getSchema();

    if (!tables.anos) {
      ok(res, []);
      return;
    }

    let sql = `
      SELECT
        a.id AS anoId,
        mo.id AS modeloId,
        ma.${maCols.id} AS marcaId,
        ma.${maCols.nome} AS marca,
        mo.${mCols.nome} AS modelo,
        a.${aCols.ano} AS ano,
        a.${aCols.combustivel} AS combustivel,
        a.${aCols.valor} AS valor,
        a.${aCols.codigoFipe} AS codigoFipe
      FROM ${tables.anos} a
      JOIN ${tables.modelos} mo ON mo.id = a.${aCols.modeloId}
      JOIN ${tables.marcas} ma ON ma.${maCols.id} = mo.${mCols.marcaId}
      WHERE (mo.${mCols.nome} LIKE ? OR ma.${maCols.nome} LIKE ?)
    `;
    const term = `%${q}%`;
    const params = [term, term];

    if (tipo && maCols.tipoId) {
      sql += ` AND ma.${maCols.tipoId} = (SELECT id FROM tipos WHERE codigo = ?)`;
      params.push(tipo);
    }

    sql += ` ORDER BY a.${aCols.valor} DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(sql).all(...params);
    ok(res, rows);
  } catch (err) {
    fail(res, err);
  }
}
