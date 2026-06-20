import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PATHS = {
  srcVeiculos: path.join(ROOT, 'src', 'data', 'fipe', 'veiculos.json'),
  parquet: path.join(ROOT, 'data', 'raw', 'fipex-prices-latest-merged.parquet'),
  coverageValidation: path.join(ROOT, 'data', 'reports', 'coverage-validation.json'),
  reportsRoot: path.join(ROOT, 'data', 'reports'),
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };
  return {
    sample: parseInt(get('--sample') ?? '1000', 10),
    seed: parseInt(get('--seed') ?? '42', 10),
  };
}

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, seed) {
  const rand = mulberry32(seed);
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function norm(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** FIPE zero-km: parquet uses NULL (sometimes 0/32000); import stores ano 0. */
const ZERO_KM_PARQUET_ANOS = new Set([0, 32000]);

function parquetAnoToLocal(anoModelo) {
  if (anoModelo == null || ZERO_KM_PARQUET_ANOS.has(Number(anoModelo))) return 0;
  return Number(anoModelo);
}

function localAnoMatchesParquet(localAno, parquetAnoModelo) {
  return parquetAnoToLocal(localAno) === parquetAnoToLocal(parquetAnoModelo);
}

function parquetAnoSqlClause(localAno) {
  if (Number(localAno) === 0) {
    return '(ano_modelo IS NULL OR ano_modelo = 0 OR ano_modelo = 32000)';
  }
  return `ano_modelo = ${Number(localAno)}`;
}

function queryAll(db, sql) {
  const conn = db.connect();
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => {
      conn.close();
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function loadDuckDb() {
  try {
    return await import('duckdb');
  } catch {
    console.error('Instale: npm install -D duckdb');
    process.exit(1);
  }
}

async function main() {
  const { sample, seed } = parseArgs();

  if (!fs.existsSync(PATHS.parquet)) {
    console.error('Parquet nao encontrado:', PATHS.parquet);
    process.exit(1);
  }

  const veiculos = JSON.parse(fs.readFileSync(PATHS.srcVeiculos, 'utf-8'));
  const picked = shuffle(veiculos, seed).slice(0, Math.min(sample, veiculos.length));

  const duckdb = await loadDuckDb();
  const db = new duckdb.default.Database(':memory:');
  const abs = path.resolve(PATHS.parquet).replace(/\\/g, '/');

  const [refRow] = await queryAll(
    db,
    `SELECT MAX(ano_referencia * 100 + mes_referencia) AS ref_key FROM read_parquet('${abs}')`,
  );
  const refKey = Number(refRow.ref_key);

  let acertos = 0;
  const divergencias = [];
  const batch = 50;

  for (let i = 0; i < picked.length; i += batch) {
    const slice = picked.slice(i, i + batch);
    const cond = slice
      .map((v) => {
        const codigo = v.fipeCodigo.replace(/'/g, "''");
        const comb = v.combustivel.replace(/'/g, "''");
        return `(codigo_fipe = '${codigo}' AND ${parquetAnoSqlClause(v.ano)} AND nome_combustivel = '${comb}')`;
      })
      .join(' OR ');

    const sql = `
      SELECT codigo_fipe, nome_marca, nome_modelo, ano_modelo, nome_combustivel, valor_centavos
      FROM read_parquet('${abs}')
      WHERE (${cond}) AND (ano_referencia * 100 + mes_referencia) = ${refKey}
    `;

    const rows = await queryAll(db, sql);
    const map = new Map(
      rows.map((row) => [
        `${row.codigo_fipe}|${parquetAnoToLocal(row.ano_modelo)}|${row.nome_combustivel}`,
        row,
      ]),
    );

    for (const v of slice) {
      const key = `${v.fipeCodigo}|${v.ano}|${v.combustivel}`;
      const src = map.get(key);
      const erros = [];

      if (!src) {
        erros.push('nao_encontrado_na_fonte');
      } else {
        if (norm(src.nome_marca) !== norm(v.marca)) erros.push('marca');
        if (norm(src.nome_modelo) !== norm(v.modelo)) erros.push('modelo');
        if (!localAnoMatchesParquet(v.ano, src.ano_modelo)) erros.push('ano');
        if (norm(src.nome_combustivel) !== norm(v.combustivel)) erros.push('combustivel');
        if (String(src.codigo_fipe) !== String(v.fipeCodigo)) erros.push('fipeCodigo');
        if (Math.round(Number(src.valor_centavos) / 100) !== Number(v.valor)) erros.push('valor');
      }

      if (!erros.length) {
        acertos += 1;
      } else {
        divergencias.push({
          id: v.id,
          fipeCodigo: v.fipeCodigo,
          erros,
          local: {
            marca: v.marca,
            modelo: v.modelo,
            ano: v.ano,
            combustivel: v.combustivel,
            valor: v.valor,
          },
          fonte: src
            ? {
                marca: src.nome_marca,
                modelo: src.nome_modelo,
                ano: parquetAnoToLocal(src.ano_modelo),
                combustivel: src.nome_combustivel,
                valor: Math.round(Number(src.valor_centavos) / 100),
              }
            : null,
        });
      }
    }

    console.log('  validados:', Math.min(i + batch, picked.length), '/', picked.length);
  }

  const total = picked.length;
  const taxa = total ? (acertos / total) * 100 : 0;
  const causasErro = {};
  for (const d of divergencias) {
    for (const e of d.erros) {
      causasErro[e] = (causasErro[e] ?? 0) + 1;
    }
  }

  const report = {
    geradoEm: new Date().toISOString(),
    fonte: PATHS.parquet,
    referenciaFipe: refKey,
    amostra: { total, seed, solicitado: sample },
    resultados: {
      acertos,
      divergencias: divergencias.length,
      taxaAcerto: Math.round(taxa * 100) / 100,
      taxaDivergencia: Math.round((100 - taxa) * 100) / 100,
      meta99Porcento: taxa >= 99,
    },
    causasErro,
    amostraDivergencias: divergencias.slice(0, 25),
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.coverageValidation, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report.resultados, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
