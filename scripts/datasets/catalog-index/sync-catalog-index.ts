/**
 * Indice central de PDFs OEM — descoberta mensal, hash incremental, 1809 familias.
 */
import fs from "fs";
import path from "path";
import { PATHS } from "../../lib/fipe-paths.js";
import {
  buildAllFamilies,
  loadHashes,
  loadIndex,
  localPdfPath,
  matchFamiliaKey,
  saveHashes,
  saveIndex,
  sha256,
  type CatalogIndexEntry,
} from "../../lib/catalog-index.js";
import { parsePdfSpecText } from "../manufacturers/adapters/pdf-catalog.js";
import type { ManufacturerRecord } from "../../lib/enrichment/manufacturer-record.js";

type PdfTarget = { slug: string; marca: string; url: string; modelo: string; ano?: number; tipo?: string };

function loadPdfTargets(): PdfTarget[] {
  const adapters = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/sources/manufacturer-adapters.json"), "utf8"));
  const out: PdfTarget[] = [];
  for (const b of adapters.brands ?? []) {
    for (const p of b.pdfCatalogs ?? []) {
      out.push({ slug: b.slug, marca: b.nome, url: p.url, modelo: p.modelo, ano: p.ano, tipo: "catalogo" });
    }
  }
  if (fs.existsSync(PATHS.catalogsManifest)) {
    const m = JSON.parse(fs.readFileSync(PATHS.catalogsManifest, "utf8")) as { marcas?: Array<{ slug: string; pdfs: Array<{ url: string; modelo?: string; ano?: number; tipo?: string }> }> };
    for (const row of m.marcas ?? []) {
      const marca = (adapters.brands ?? []).find((b: { slug: string }) => b.slug === row.slug)?.nome ?? row.slug;
      for (const p of row.pdfs ?? []) {
        out.push({ slug: row.slug, marca, url: p.url, modelo: p.modelo ?? "Catalogo", ano: p.ano, tipo: p.tipo });
      }
    }
  }
  const dedup = new Map<string, PdfTarget>();
  for (const t of out) dedup.set(t.url.split("#")[0], t);
  return [...dedup.values()];
}

async function fetchPdf(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": "consulta-tabela-fipe/1.0" }, signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

async function syncOne(t: PdfTarget, hashes: Record<string, string>, force: boolean): Promise<{ entry: CatalogIndexEntry; downloaded: boolean; changed: boolean }> {
  const url = t.url.split("#")[0];
  const rel = localPdfPath(t.slug, url);
  const dest = path.join(PATHS.catalogIndexPdfs, rel);
  let buf: Buffer;
  let downloaded = false;
  let changed = false;

  if (!force && fs.existsSync(dest)) {
    buf = fs.readFileSync(dest);
    const h = sha256(buf);
    if (hashes[url] === h) {
      return {
        entry: { marca: t.marca, modelo: t.modelo, ano: t.ano ?? null, pdf: url, localPath: rel, hash: h, captured_at: new Date().toISOString(), familiaKey: matchFamiliaKey(t.marca, t.modelo), tipo: t.tipo },
        downloaded: false,
        changed: false,
      };
    }
  }

  try {
    buf = await fetchPdf(url);
    downloaded = true;
  } catch (e) {
    if (fs.existsSync(dest)) buf = fs.readFileSync(dest);
    else throw e;
  }

  const h = sha256(buf);
  changed = hashes[url] !== h;
  if (changed || !fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }
  hashes[url] = h;

  return {
    entry: { marca: t.marca, modelo: t.modelo, ano: t.ano ?? null, pdf: url, localPath: rel, hash: h, captured_at: new Date().toISOString(), familiaKey: matchFamiliaKey(t.marca, t.modelo), tipo: t.tipo },
    downloaded,
    changed,
  };
}

async function main() {
  const force = process.argv.includes("--force");
  const targets = loadPdfTargets();
  const hashes = loadHashes();
  const existing = loadIndex();
  const byUrl = new Map(existing.map((e) => [e.pdf, e]));

  let downloaded = 0;
  let changed = 0;
  let skipped = 0;
  const entradas: CatalogIndexEntry[] = [];

  for (const t of targets) {
    try {
      const r = await syncOne(t, hashes, force);
      entradas.push(r.entry);
      byUrl.set(r.entry.pdf, r.entry);
      if (r.downloaded) downloaded++;
      if (r.changed) changed++;
      if (!r.downloaded && !r.changed) skipped++;
      console.log("[index]", t.slug, t.modelo, r.changed ? "updated" : r.downloaded ? "new" : "cached");
    } catch (e) {
      console.warn("[index] fail", t.url, (e as Error).message);
      const prev = byUrl.get(t.url.split("#")[0]);
      if (prev) entradas.push(prev);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  saveHashes(hashes);
  saveIndex(entradas, { downloaded, changed, skipped, targets: targets.length });

  const families = buildAllFamilies();
  const pdfByFam = new Map<string, number>();
  for (const e of entradas) {
    if (e.familiaKey) pdfByFam.set(e.familiaKey, (pdfByFam.get(e.familiaKey) ?? 0) + 1);
  }
  for (const f of families) f.pdfs = pdfByFam.get(f.familiaKey) ?? 0;
  fs.writeFileSync(PATHS.familiesTarget, JSON.stringify({ geradoEm: new Date().toISOString(), totalFamilias: families.length, familias: families }, null, 2), "utf8");

  const records: ManufacturerRecord[] = [];
  const { PDFParse } = await import("pdf-parse");
  for (const e of entradas) {
    const dest = path.join(PATHS.catalogIndexPdfs, e.localPath);
    if (!fs.existsSync(dest)) continue;
    try {
      const parser = new PDFParse({ data: fs.readFileSync(dest) });
      const text = (await parser.getText()).text ?? "";
      await parser.destroy();
      const rec = parsePdfSpecText(text, e.marca, e.modelo, e.pdf, e.ano ?? undefined);
      if (rec) records.push(rec);
    } catch {}
  }
  fs.writeFileSync(PATHS.rawCatalogsParsed, JSON.stringify({ geradoEm: new Date().toISOString(), source: "catalog-index", records }, null, 2), "utf8");

  console.log(JSON.stringify({ entradas: entradas.length, familias: families.length, comPdf: families.filter((f) => f.pdfs > 0).length, downloaded, changed, skipped, parsed: records.length }));
}

main().catch((e) => { console.error(e); process.exit(1); });
