import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PATHS = {
  reportsRoot: path.join(ROOT, 'data', 'reports'),
  out: path.join(ROOT, 'data', 'reports', 'executive-report.json'),
};

function readJson(name) {
  const file = path.join(PATHS.reportsRoot, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function proximaPrioridade({ cobertura, qualidade, historico, seo, performance }) {
  if (cobertura && cobertura.resultados && cobertura.resultados.meta99Porcento === false) {
    return 'corrigir_divergencias_cobertura';
  }
  if (qualidade?.problemas?.idsDuplicados > 0) {
    return 'resolver_ids_duplicados';
  }
  if (!historico || (historico.metricas?.arquivosHistorico ?? 0) === 0) {
    return 'importar_historico_completo';
  }
  if (seo && seo.totais?.urlsSeoPotencial > seo.totais?.urlsCatalogoAtual) {
    return 'expandir_paginas_seo';
  }
  if (performance?.cargas?.veiculosJson?.ms > 500) {
    return 'otimizar_carga_catalogo';
  }
  return 'manter_rotina_mensal';
}

function main() {
  const dataQuality = readJson('data-quality-report.json');
  const coverage = readJson('coverage-validation.json');
  const history = readJson('history-report.json');
  const seo = readJson('seo-opportunities.json');
  const performance = readJson('performance-report.json');

  const report = {
    geradoEm: new Date().toISOString(),
    cobertura: coverage,
    qualidade: dataQuality,
    erros: {
      cobertura: coverage?.causasErro ?? {},
      qualidade: dataQuality?.problemas ?? null,
    },
    historico: history,
    seo,
    performance,
    proximaPrioridade: proximaPrioridade({
      cobertura: coverage,
      qualidade: dataQuality,
      historico: history,
      seo,
      performance,
    }),
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ proximaPrioridade: report.proximaPrioridade }, null, 2));
}

main();
