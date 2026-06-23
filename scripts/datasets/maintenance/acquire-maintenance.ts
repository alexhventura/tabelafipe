/**
 * datasets:maintenance:acquire — extrai oleo, bateria, pneus, fluidos de PDFs indexados.
 */
import fs from "fs";
import path from "path";
import { PATHS } from "../../lib/fipe-paths.js";
import { loadIndex } from "../../lib/catalog-index.js";
import { parseMaintenanceText, type MaintenanceRecord } from "../../lib/enrichment/parse-maintenance-pdf.js";

async function main() {
  const entradas = loadIndex();
  const records: MaintenanceRecord[] = [];
  const { PDFParse } = await import("pdf-parse");

  for (const e of entradas) {
    const dest = path.join(PATHS.catalogIndexPdfs, e.localPath);
    if (!fs.existsSync(dest)) continue;
    try {
      const parser = new PDFParse({ data: fs.readFileSync(dest) });
      const text = (await parser.getText()).text ?? "";
      await parser.destroy();
      const rec = parseMaintenanceText(text, e.marca, e.modelo, e.pdf, e.ano ?? undefined);
      if (rec) records.push(rec);
    } catch {}
  }

  const byKey = new Map<string, MaintenanceRecord>();
  for (const r of records) {
    const k = r.marca + "|" + r.modelo + "|" + (r.ano ?? "");
    if (!byKey.has(k)) byKey.set(k, r);
  }

  const out = {
    geradoEm: new Date().toISOString(),
    total: byKey.size,
    registros: Object.fromEntries(byKey),
  };

  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(PATHS.maintenanceSpecs, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(PATHS.manualSpecs, JSON.stringify({ ...out, camada: "manutencao" }, null, 2), "utf8");
  console.log(JSON.stringify({ pdfs: entradas.length, registros: byKey.size }));
}

main().catch((e) => { console.error(e); process.exit(1); });
