/**
 * Document Acquisition Engine orchestrator.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PATHS } from "../../lib/fipe-paths.js";
import { buildAllFamilies } from "../../lib/catalog-index.js";
import { loadLibrary } from "../../lib/document-library.js";
import {
  appendAcquisitionLog,
  countCandidateUrls,
  isQueueStale,
  loadAcquisitionQueue,
} from "../../lib/document-acquisition-engine.js";

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function runDiscover() {
  execSync("npx tsx scripts/datasets/document-library/discover-documents.ts", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}

function runSync() {
  execSync("npx tsx scripts/datasets/document-library/sync-document-library.ts", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}

async function main() {
  const discover = hasFlag("--discover");
  const queue = loadAcquisitionQueue();
  if (discover || isQueueStale(queue)) {
    console.log("[dae] running discover", { discover, stale: isQueueStale(queue) });
    runDiscover();
  }

  console.log("[dae] syncing document library");
  runSync();

  const documents = loadLibrary();
  const familias = fs.existsSync(PATHS.familiesTarget)
    ? ((JSON.parse(fs.readFileSync(PATHS.familiesTarget, "utf8")) as { familias?: ReturnType<typeof buildAllFamilies> }).familias ??
      buildAllFamilies())
    : buildAllFamilies();
  const familiasCobertas = familias.filter((f) => (f.pdfs ?? 0) > 0).length;
  const urlsCandidatas = countCandidateUrls(loadAcquisitionQueue());

  const summary = {
    geradoEm: new Date().toISOString(),
    mission: "documents-not-cars",
    kpi: {
      pdfs_indexados: documents.length,
      familias_cobertas: familiasCobertas,
      familias_total: familias.length,
      urls_candidatas: urlsCandidatas,
    },
  };

  appendAcquisitionLog(summary);

  const outPath = path.join(PATHS.documentLibraryRoot, "acquisition-summary.json");
  fs.mkdirSync(PATHS.documentLibraryRoot, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});