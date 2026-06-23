import fs from "fs";
import path from "path";
import { PATHS } from "../../lib/fipe-paths.js";
import { parsePdfSpecText } from "../manufacturers/adapters/pdf-catalog.js";
import type { ManufacturerRecord } from "../../lib/enrichment/manufacturer-record.js";

type Target = { slug: string; nome: string; url: string; modelo: string; ano?: number };

function loadTargets(): Target[] {
  const adapters = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "sources", "manufacturer-adapters.json"), "utf8"));
  const out: Target[] = [];
  for (const b of adapters.brands ?? []) {
    for (const p of b.pdfCatalogs ?? []) out.push({ slug: b.slug, nome: b.nome, url: p.url, modelo: p.modelo, ano: p.ano });
  }
  if (fs.existsSync(PATHS.catalogsManifest)) {
    const manifest = JSON.parse(fs.readFileSync(PATHS.catalogsManifest, "utf8")) as { marcas?: Array<{ slug: string; pdfs: Array<{ url: string; modelo?: string; ano?: number }> }> };
    for (const m of manifest.marcas ?? []) {
      const nome = (adapters.brands ?? []).find((b: { slug: string }) => b.slug === m.slug)?.nome ?? m.slug;
      for (const p of m.pdfs ?? []) out.push({ slug: m.slug, nome, url: p.url, modelo: p.modelo ?? "Catalogo", ano: p.ano });
    }
  }
  const dedup = new Map<string, Target>();
  for (const t of out) dedup.set(t.url.split("#")[0], t);
  return [...dedup.values()];
}

function filenameFromUrl(url: string): string {
  const base = url.split("/").pop()?.split("?")[0] ?? "catalogo.pdf";
  return base.toLowerCase().endsWith(".pdf") ? base : base + ".pdf";
}

async function downloadPdf(url: string, dest: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": "consulta-tabela-fipe/1.0" }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf;
}

async function main() {
  const { PDFParse } = await import("pdf-parse");
  const targets = loadTargets();
  const records: ManufacturerRecord[] = [];
  for (const t of targets) {
    const rel = path.join(t.slug, filenameFromUrl(t.url));
    const dest = path.join(PATHS.rawCatalogs, rel);
    try {
      const buf = fs.existsSync(dest) ? fs.readFileSync(dest) : await downloadPdf(t.url, dest);
      const parser = new PDFParse({ data: buf });
      const text = (await parser.getText()).text ?? "";
      await parser.destroy();
      const rec = parsePdfSpecText(text, t.nome, t.modelo, t.url, t.ano);
      if (rec) { rec.adapterId = t.slug; records.push(rec); }
      console.log("[pdf]", t.slug, t.modelo, rec ? "ok" : "empty");
    } catch (e) {
      console.warn("[pdf]", t.slug, t.url, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fs.mkdirSync(path.dirname(PATHS.rawCatalogsParsed), { recursive: true });
  fs.writeFileSync(PATHS.rawCatalogsParsed, JSON.stringify({ geradoEm: new Date().toISOString(), records }, null, 2), "utf8");
  console.log(JSON.stringify({ targets: targets.length, records: records.length }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
