import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** FIPE zero-km: parquet uses NULL (sometimes 0/32000); import stores ano 0. */
const ZERO_KM_PARQUET_ANOS = new Set([0, 32000]);

function parquetAnoToLocal(anoModelo) {
  if (anoModelo == null || ZERO_KM_PARQUET_ANOS.has(Number(anoModelo))) return 0;
  return Number(anoModelo);
}

const PATHS = {
  srcVeiculos: path.join(ROOT, 'src', 'data', 'fipe', 'veiculos.json'),
  parquet: path.join(ROOT, 'data', 'raw', 'fipex-prices-latest-merged.parquet'),
  historyRoot: path.join(ROOT, 'data', 'history'),
  historyReport: path.join(ROOT, 'data', 'reports', 'history-report.json'),
  reportsRoot: path.join(ROOT, 'data', 'reports'),
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (f) => {
    const i = args.indexOf(f);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };
  return {
    limit: parseInt(get('--limit') ?? '0', 10),
    force: args.includes('--force'),
  };
}

function formatMesRef(ano, mes) {
  return `${MESES[mes - 1] ?? 'Jan'}/${String(ano).slice(-2)}`;
}

function isoDate(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
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

function calcMetricas(pontos) {
  if (!pontos.length) {
    return {
      menorPreco: null,
      maiorPreco: null,
      valorizacaoPercentual: null,
      desvalorizacaoPercentual: null,
      mediaAnual: null,
      totalReferencias: 0,
    };
  }

  const valores = pontos.map((p) => p.valor);
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const primeiro = pontos[0].valor;
  const ultimo = pontos[pontos.length - 1].valor;
  const diff = ultimo - primeiro;
  const pct = primeiro > 0 ? (diff / primeiro) * 100 : null;

  const anos = new Set(pontos.map((p) => p.data.slice(0, 4)));
  const mediaAnual = anos.size > 1 ? diff / anos.size : null;

  return {
    menorPreco: menor,
    maiorPreco: maior,
    valorizacaoPercentual: pct !== null && pct > 0 ? Math.round(pct * 100) / 100 : null,
    desvalorizacaoPercentual: pct !== null && pct < 0 ? Math.round(Math.abs(pct) * 100) / 100 : null,
    mediaAnual: mediaAnual !== null ? Math.round(mediaAnual) : null,
    totalReferencias: pontos.length,
  };
}

async function main() {
  const { limit, force } = parseArgs();
  if (!fs.existsSync(PATHS.parquet)) {
    console.error('Parquet nao encontrado:', PATHS.parquet);
    process.exit(1);
  }

  const veiculos = JSON.parse(fs.readFileSync(PATHS.srcVeiculos, 'utf-8'));
  const alvo = limit > 0 ? veiculos.slice(0, limit) : veiculos;

  fs.mkdirSync(PATHS.historyRoot, { recursive: true });

  const duckdb = await loadDuckDb();
  const db = new duckdb.default.Database(':memory:');
  const abs = path.resolve(PATHS.parquet).replace(/\\/g, '/');

  const lookup = new Map();
  for (const v of alvo) {
    const key = `${v.fipeCodigo}|${v.ano}|${v.combustivel}`;
    lookup.set(key, v);
  }

  const codes = [...new Set(alvo.map((v) => v.fipeCodigo))];
  let importados = 0;
  let totalPontos = 0;
  let pulados = 0;
  const batch = 400;

  for (let i = 0; i < codes.length; i += batch) {
    const slice = codes.slice(i, i + batch);
    const inList = slice.map((c) => `'${c.replace(/'/g, "''")}'`).join(',');
    const sql = `
      SELECT codigo_fipe, ano_modelo, CASE WHEN ano_modelo IS NULL OR ano_modelo = 0 OR ano_modelo = 32000 THEN 0 ELSE ano_modelo END AS ano_local, nome_combustivel, ano_referencia, mes_referencia, valor_centavos
      FROM read_parquet('${abs}')
      WHERE codigo_fipe IN (${inList})
      ORDER BY codigo_fipe, ano_local, ano_referencia, mes_referencia
    `;
    const rows = await queryAll(db, sql);

    const grouped = new Map();
    for (const row of rows) {
      const key = `${row.codigo_fipe}|${Number(row.ano_local)}|${row.nome_combustivel}`;
      if (!lookup.has(key)) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({
        referencia: formatMesRef(Number(row.ano_referencia), Number(row.mes_referencia)),
        data: isoDate(Number(row.ano_referencia), Number(row.mes_referencia)),
        valor: Math.round(Number(row.valor_centavos) / 100),
      });
    }

    for (const [key, pontos] of grouped) {
      const v = lookup.get(key);
      const outFile = path.join(PATHS.historyRoot, `${v.id}.json`);
      if (!force && fs.existsSync(outFile)) {
        pulados++;
        continue;
      }
      const payload = {
        id: v.id,
        fipeCodigo: v.fipeCodigo,
        marca: v.marca,
        modelo: v.modelo,
        ano: v.ano,
        combustivel: v.combustivel,
        historico: pontos,
        metricas: calcMetricas(pontos),
      };
      fs.writeFileSync(outFile, JSON.stringify(payload));
      importados++;
      totalPontos += pontos.length;
    }

    console.log('  batch:', Math.min(i + batch, codes.length), '/', codes.length);
  }

  const historyFiles = fs.readdirSync(PATHS.historyRoot).filter((f) => f.endsWith('.json'));
  const report = {
    geradoEm: new Date().toISOString(),
    fonte: PATHS.parquet,
    metricas: {
      veiculosAlvo: alvo.length,
      arquivosHistorico: historyFiles.length,
      importadosNestaExecucao: importados,
      puladosExistentes: pulados,
      totalPontosHistorico: totalPontos,
      mediaPontosPorVeiculo: importados > 0 ? Math.round(totalPontos / importados) : null,
    },
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.historyReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
