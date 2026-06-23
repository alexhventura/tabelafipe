import fs from "fs";
import { PATHS } from "../lib/fipe-paths.js";
import { buildAllFamilies } from "../lib/catalog-index.js";
import { loadLibrary } from "../lib/document-library.js";
import { countCandidateUrls, loadAcquisitionQueue } from "../lib/document-acquisition-engine.js";
import type { DocumentType } from "../lib/document-acquisition-engine.js";

function progressPct(current: number, target: number): number {
  if (!target) return 0;
  return Math.round((current / target) * 10000) / 100;
}

function runsInWindow(days: number): number {
  if (!fs.existsSync(PATHS.documentAcquisitionLog)) return 0;
  const log = JSON.parse(fs.readFileSync(PATHS.documentAcquisitionLog, "utf8")) as {
    runs?: Array<{ logged_at?: string; kpi?: { pdfs_indexados?: number } }>;
  };
  const cutoff = Date.now() - days * 86400000;
  return (log.runs ?? []).filter((r) => r.logged_at && Date.parse(r.logged_at) >= cutoff).length;
}

function deltaPdfs(days: number): number {
  if (!fs.existsSync(PATHS.documentAcquisitionLog)) return 0;
  const log = JSON.parse(fs.readFileSync(PATHS.documentAcquisitionLog, "utf8")) as {
    runs?: Array<{ logged_at?: string; kpi?: { pdfs_indexados?: number } }>;
  };
  const runs = (log.runs ?? []).filter((r) => r.logged_at).sort((a, b) => Date.parse(a.logged_at!) - Date.parse(b.logged_at!));
  if (!runs.length) return 0;
  const cutoff = Date.now() - days * 86400000;
  const old = [...runs].reverse().find((r) => Date.parse(r.logged_at!) <= cutoff);
  const latest = runs[runs.length - 1];
  const prev = old?.kpi?.pdfs_indexados ?? runs[0].kpi?.pdfs_indexados ?? 0;
  const now = latest.kpi?.pdfs_indexados ?? 0;
  return Math.max(0, now - prev);
}

async function main() {
  const documents = loadLibrary();
  const familias = fs.existsSync(PATHS.familiesTarget)
    ? ((JSON.parse(fs.readFileSync(PATHS.familiesTarget, "utf8")) as { familias?: ReturnType<typeof buildAllFamilies> }).familias ??
      buildAllFamilies())
    : buildAllFamilies();
  const familiasCobertas = familias.filter((f) => (f.pdfs ?? 0) > 0).length;
  const urlsCandidatas = countCandidateUrls(loadAcquisitionQueue());
  const metas = { dias30: 500, dias60: 2000, dias90: 5000 };

  const por_tipo_documento: Record<string, number> = {};
  for (const d of documents) {
    const t = d.type as DocumentType;
    por_tipo_documento[t] = (por_tipo_documento[t] ?? 0) + 1;
  }

  const top_documentos_ricos = [...documents]
    .sort((a, b) => b.richness.richnessScore - a.richness.richnessScore)
    .slice(0, 20)
    .map((d) => ({
      id: d.id,
      marca: d.marca,
      modelo: d.modelo,
      type: d.type,
      richnessScore: d.richness.richnessScore,
      url: d.url,
    }));

  const proximas_familias_alvo = familias
    .filter((f) => (f.pdfs ?? 0) === 0)
    .sort((a, b) => b.totalVeiculos - a.totalVeiculos)
    .slice(0, 20)
    .map((f) => ({
      familiaKey: f.familiaKey,
      marca: f.marca,
      modeloFamilia: f.modeloFamilia,
      totalVeiculos: f.totalVeiculos,
    }));

  const pdfs = documents.length;
  const progress_30d_pct = progressPct(deltaPdfs(30) || pdfs, metas.dias30);
  const progress_90d_pct = progressPct(pdfs, metas.dias90);

  const dashboard = {
    geradoEm: new Date().toISOString(),
    kpi: {
      pdfs_indexados: pdfs,
      familias_cobertas: familiasCobertas,
      familias_total: familias.length,
      urls_candidatas: urlsCandidatas,
      progress_30d_pct,
      progress_90d_pct,
      acquisition_runs_30d: runsInWindow(30),
    },
    metas,
    por_tipo_documento,
    top_documentos_ricos,
    proximas_familias_alvo,
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.acquisitionDashboard, JSON.stringify(dashboard, null, 2), "utf8");

  const metrics = {
    geradoEm: dashboard.geradoEm,
    pdfs_indexados: pdfs,
    familias_total: familias.length,
    familias_com_pdf: familiasCobertas,
    metas,
    progress_pct: progress_90d_pct,
    acquisition_dashboard: PATHS.acquisitionDashboard,
    top_richest_documents: top_documentos_ricos,
    familias_sem_pdf: proximas_familias_alvo,
  };
  fs.writeFileSync(PATHS.documentLibraryMetrics, JSON.stringify(metrics, null, 2), "utf8");

  console.log(JSON.stringify(dashboard, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});