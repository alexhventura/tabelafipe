import fs from "fs";
import { PATHS } from "../lib/fipe-paths.js";
import { buildAllFamilies, matchFamiliaKey } from "../lib/catalog-index.js";
import type { MaintenanceRecord } from "../lib/enrichment/parse-maintenance-pdf.js";

function profileSignature(r: MaintenanceRecord): string {
  const oleo = (r.oleoRecomendado ?? "").toLowerCase().replace(/\s+/g, "");
  const cap = r.capacidadeOleoL != null ? String(r.capacidadeOleoL) : "";
  if (oleo || cap) return "oleo|" + oleo + "|" + cap;
  if (r.pneusMedida) return "pneus|" + r.pneusMedida.toLowerCase().replace(/\s+/g, "");
  return "";
}

async function main() {
  if (!fs.existsSync(PATHS.maintenanceSpecs)) {
    console.log(JSON.stringify({ nodes: 0, warning: "maintenance-specs missing" }));
    return;
  }
  const specs = JSON.parse(fs.readFileSync(PATHS.maintenanceSpecs, "utf8")) as { registros: Record<string, MaintenanceRecord> };
  const families = buildAllFamilies();

  const profiles = new Map<string, { id: string; oleo: string; capacidadeOleoL?: number; pneusMedida?: string; vehicleKeys: string[]; familiaKeys: string[] }>();
  const edges: Array<{ from: string; to: string; kind: "vehicle" | "familia" }> = [];

  for (const [key, rec] of Object.entries(specs.registros ?? {})) {
    const sig = profileSignature(rec);
    if (!sig.length) continue;
    const pid = "maint-" + Buffer.from(sig).toString("hex").slice(0, 12);
    const fk = matchFamiliaKey(rec.marca, rec.modelo);
    const node = profiles.get(pid) ?? { id: pid, oleo: rec.oleoRecomendado ?? "", capacidadeOleoL: rec.capacidadeOleoL, pneusMedida: rec.pneusMedida, vehicleKeys: [], familiaKeys: [] };
    if (!node.vehicleKeys.includes(key)) node.vehicleKeys.push(key);
    if (fk && !node.familiaKeys.includes(fk)) node.familiaKeys.push(fk);
    profiles.set(pid, node);
    edges.push({ from: pid, to: key, kind: "vehicle" });
    if (fk) edges.push({ from: pid, to: fk, kind: "familia" });
  }

  const nodes = [...profiles.values()];
  const out = { geradoEm: new Date().toISOString(), nodes, edges, totalNodes: nodes.length, totalEdges: edges.length };
  fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
  fs.writeFileSync(PATHS.maintenanceGraph, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ nodes: nodes.length, edges: edges.length }));
}

main().catch((e) => { console.error(e); process.exit(1); });
