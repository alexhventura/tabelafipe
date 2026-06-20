import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PATHS = {
  srcVeiculos: path.join(ROOT, 'src', 'data', 'fipe', 'veiculos.json'),
  reportsRoot: path.join(ROOT, 'data', 'reports'),
  dataQualityReport: path.join(ROOT, 'data', 'reports', 'data-quality-report.json'),
};

function audit() {
  const veiculos = JSON.parse(fs.readFileSync(PATHS.srcVeiculos, 'utf-8'));
  const ids = new Map();
  for (const v of veiculos) {
    if (!ids.has(v.id)) ids.set(v.id, []);
    ids.get(v.id).push(v);
  }
  const idDuplicates = [...ids.entries()].filter(([, l]) => l.length > 1);
  const marcas = new Set(veiculos.map((v) => v.marca));
  const modelos = new Set(veiculos.map((v) => `${v.marca}|${v.modelo}`));
  const anos = new Set(veiculos.map((v) => v.ano));
  const versoes = new Set(
    veiculos.map((v) => `${v.marca}|${v.modelo}|${v.ano}|${v.combustivel ?? ''}`),
  );

  const report = {
    geradoEm: new Date().toISOString(),
    totais: {
      veiculos: veiculos.length,
      marcas: marcas.size,
      modelos: modelos.size,
      versoes: versoes.size,
      anos: anos.size,
      porTipo: {
        carros: veiculos.filter((v) => v.tipo === 'carros').length,
        motos: veiculos.filter((v) => v.tipo === 'motos').length,
        caminhoes: veiculos.filter((v) => v.tipo === 'caminhoes').length,
      },
    },
    problemas: {
      idsDuplicados: idDuplicates.length,
      registrosPerdidosPorIdDuplicado: idDuplicates.reduce((s, [, l]) => s + l.length - 1, 0),
      semValor: veiculos.filter((v) => !v.valor || v.valor <= 0).length,
      semCombustivel: veiculos.filter((v) => !v.combustivel?.trim()).length,
      semCodigoFipe: veiculos.filter((v) => !v.fipeCodigo?.trim()).length,
      semMarca: veiculos.filter((v) => !v.marca?.trim()).length,
      semModelo: veiculos.filter((v) => !v.modelo?.trim()).length,
      semAno: veiculos.filter((v) => !v.ano || v.ano <= 0).length,
    },
    amostraIdsDuplicados: idDuplicates.slice(0, 10).map(([id, list]) => ({
      id,
      ocorrencias: list.length,
      combustiveis: list.map((v) => v.combustivel),
    })),
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.dataQualityReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  return report;
}

audit();
