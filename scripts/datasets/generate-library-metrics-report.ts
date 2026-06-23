import fs from "fs";
import { PATHS } from "../lib/fipe-paths.js";
import { buildAllFamilies } from "../lib/catalog-index.js";
import { loadLibrary } from "../lib/document-library.js";

async function main() {
  const documents = loadLibrary();
  const familiesFile = fs.existsSync(PATHS.familiesTarget)
    ? (JSON.parse(fs.readFileSync(PATHS.familiesTarget, "utf8")) as { familias: ReturnType<typeof buildAllFamilies> })
    : { familias: buildAllFamilies() };
  const familias = familiesFile.familias ?? buildAllFamilies();
  const familiasTotal = familias.length;
  const familiasComPdf = familias.filter((f) => (f.pdfs ?? 0) > 0).length;
  const metas = { dias30: 500, dias60: 2000, dias90: 5000 };
  const progress_pct = Math.round((documents.length / metas.dias90) * 10000) / 100;
  const top_richest_documents = [...documents]
    .sort((a, b) => b.richness.richnessScore - a.richness.richnessScore)
    .slice(0, 20)
    .map((d) => ({ id: d.id, marca: d.marca, modelo: d.modelo, url: d.url, richnessScore: d.richness.richnessScore }));
  const familias_sem_pdf = familias
    .filter((f) => (f.pdfs ?? 0) === 0)
    .sort((a, b) => b.totalVeiculos - a.totalVeiculos)
    .slice(0, 20)
    .map((f) => ({ familiaKey: f.familiaKey, marca: f.marca, modeloFamilia: f.modeloFamilia, totalVeiculos: f.totalVeiculos }));

  const report = {
    geradoEm: new Date().toISOString(),
    pdfs_indexados: documents.length,
    familias_total: familiasTotal,
    familias_com_pdf: familiasComPdf,
    metas,
    progress_pct,
    top_richest_documents,
    familias_sem_pdf,
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.documentLibraryMetrics, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });