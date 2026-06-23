/**
 * Consolida fontes, cobertura e qualidade em um unico relatorio executivo.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

async function main() {
  const coverage = readJson(PATHS.coverageEnrichmentReport, null);
  const fieldQuality = readJson(PATHS.fieldQualityReport, { campos: [] });
  const inmetroCatalog = readJson(PATHS.inmetroPbevCatalog, { edicoes: [], historicos: [] });
  const mfrCatalog = readJson(PATHS.manufacturersCatalog, { marcas: [] });
  const inmetroReport = readJson(PATHS.inmetroCoverageReport, null);
  const mfrReport = readJson(PATHS.manufacturersCoverageReport, null);

  const pdfsDir = path.join(PATHS.rawInmetro, 'pdfs');
  const pdfsBaixados = fs.existsSync(pdfsDir)
    ? fs.readdirSync(pdfsDir).filter((f) => f.endsWith('.pdf'))
    : [];

  const summary = {
    geradoEm: new Date().toISOString(),
    objetivo: 'Medir enriquecimento real do catalogo FIPE (50.395 veiculos) antes de integracao visual',
    fontes: {
      inmetro: {
        nome: 'INMETRO PBEV',
        urlOficial: (inmetroCatalog as { fonteOficial?: string }).fonteOficial,
        formato: (inmetroCatalog as { formatoOficial?: string }).formatoOficial ?? 'PDF',
        edicoesCatalogadas: (inmetroCatalog as { edicoes?: unknown[] }).edicoes?.length ?? 0,
        pdfsBaixados: pdfsBaixados.length,
        arquivos: pdfsBaixados,
        campos: ['marca', 'modelo', 'versao', 'anoReferencia', 'combustivel', 'consumoCidade', 'consumoEstrada', 'classificacaoEnergetica', 'eficienciaMjKm'],
        confiabilidade: 'alta',
      },
      fabricantes: {
        marcasCatalogadas: (mfrCatalog as { marcas?: unknown[] }).marcas?.length ?? 0,
        marcas: ((mfrCatalog as { marcas?: { slug: string; nome: string; fonteOficial: string; status: string }[] }).marcas ?? []).map((m) => ({
          slug: m.slug,
          nome: m.nome,
          fonteOficial: m.fonteOficial,
          status: m.status,
        })),
        campos: ['potenciaCv', 'torqueNm', 'cambio', 'cilindradaCc', 'pesoKg', 'dimensoes', 'portaMalasL', 'tanqueL'],
        confiabilidade: 'alta',
      },
    },
    cobertura: (coverage as { cobertura?: unknown } | null)?.cobertura ?? null,
    porTipo: (coverage as { porTipo?: unknown } | null)?.porTipo ?? null,
    estimativaEnriquecimentoReal: (coverage as { estimativaEnriquecimentoReal?: unknown } | null)?.estimativaEnriquecimentoReal ?? null,
    qualidadePorCampo: (fieldQuality as { campos?: unknown[] }).campos ?? [],
    detalhesInmetro: inmetroReport,
    detalhesFabricantes: mfrReport,
  };

  const out = path.join(PATHS.reportsRoot, 'enrichment-summary.json');
  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });