/**
 * Pipeline principal da Biblioteca Automotiva.
 */
import fs from "fs";
import path from "path";
import { PATHS } from "../../lib/fipe-paths.js";
import {
  buildAllFamilies,
  matchFamiliaKey,
  saveHashes as saveCatalogHashes,
  sha256,
} from "../../lib/catalog-index.js";
import {
  catalogEntryToLibraryDoc,
  inferDocumentType,
  libraryFileDest,
  libraryLocalPath,
  loadLibrary,
  loadLibraryHashes,
  migrateFromCatalogIndex,
  saveLibrary,
  saveLibraryHashes,
  scoreRichnessFromText,
  syncLibraryToCatalogIndex,
  type LibraryDocument,
} from "../../lib/document-library.js";
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
    const m = JSON.parse(fs.readFileSync(PATHS.catalogsManifest, "utf8")) as {
      marcas?: Array<{ slug: string; pdfs: Array<{ url: string; modelo?: string; ano?: number; tipo?: string }> }>;
    };
    for (const row of m.marcas ?? []) {
      const marca = (adapters.brands ?? []).find((b: { slug: string }) => b.slug === row.slug)?.nome ?? row.slug;
      for (const p of row.pdfs ?? []) {
        out.push({ slug: row.slug, marca, url: p.url, modelo: p.modelo ?? "Catalogo", ano: p.ano, tipo: p.tipo });
      }
    }
  }
  const queuePath = path.join(PATHS.documentLibraryRoot, "discovery-queue.json");
  if (fs.existsSync(queuePath)) {
    const q = JSON.parse(fs.readFileSync(queuePath, "utf8")) as {
      targets?: Array<{ marca: string; modeloFamilia: string; candidateUrls?: string[] }>;
    };
    for (const t of q.targets ?? []) {
      const slug = t.marca.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      for (const url of t.candidateUrls ?? []) {
        out.push({ slug, marca: t.marca, url, modelo: t.modeloFamilia, tipo: "discovery-queue" });
      }
    }
  }
  for (const doc of loadLibrary()) {
    out.push({
      slug: doc.marca.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
      marca: doc.marca,
      url: doc.url,
      modelo: doc.modelo,
      ano: doc.ano ?? undefined,
      tipo: doc.type,
    });
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

async function parsePdfRichness(buf: Buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buf });
    const text = (await parser.getText()).text ?? "";
    await parser.destroy();
    return scoreRichnessFromText(text);
  } catch {
    return scoreRichnessFromText("");
  }
}

async function syncOne(
  t: PdfTarget,
  hashes: Record<string, string>,
  force: boolean,
): Promise<{ doc: LibraryDocument; downloaded: boolean; changed: boolean }> {
  const url = t.url.split("#")[0];
  const rel = libraryLocalPath(t.slug, url);
  const dest = libraryFileDest(rel);
  let buf: Buffer;
  let downloaded = false;
  let changed = false;

  if (!force && fs.existsSync(dest)) {
    buf = fs.readFileSync(dest);
    const h = sha256(buf);
    if (hashes[url] === h) {
      const base = catalogEntryToLibraryDoc({
        marca: t.marca,
        modelo: t.modelo,
        ano: t.ano ?? null,
        pdf: url,
        localPath: rel,
        hash: h,
        captured_at: new Date().toISOString(),
        familiaKey: matchFamiliaKey(t.marca, t.modelo),
        tipo: t.tipo,
      });
      base.type = inferDocumentType(url, path.basename(rel));
      base.richness = await parsePdfRichness(buf);
      return { doc: base, downloaded: false, changed: false };
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

  const richness = await parsePdfRichness(buf);

  const doc = catalogEntryToLibraryDoc({
    marca: t.marca,
    modelo: t.modelo,
    ano: t.ano ?? null,
    pdf: url,
    localPath: rel,
    hash: h,
    captured_at: new Date().toISOString(),
    familiaKey: matchFamiliaKey(t.marca, t.modelo),
    tipo: t.tipo,
  });
  doc.type = inferDocumentType(url, path.basename(rel));
  doc.richness = richness;

  return { doc, downloaded, changed };
}

async function main() {
  const force = process.argv.includes("--force");
  let documents = migrateFromCatalogIndex();
  const byUrl = new Map(documents.map((d) => [d.url.split("#")[0], d]));

  const targets = loadPdfTargets();
  const hashes = { ...loadLibraryHashes(), ...(fs.existsSync(PATHS.catalogIndexHashes) ? JSON.parse(fs.readFileSync(PATHS.catalogIndexHashes, "utf8")) : {}) };

  let downloaded = 0;
  let changed = 0;
  let skipped = 0;

  for (const t of targets) {
    try {
      const r = await syncOne(t, hashes, force);
      byUrl.set(r.doc.url.split("#")[0], r.doc);
      if (r.downloaded) downloaded++;
      if (r.changed) changed++;
      if (!r.downloaded && !r.changed) skipped++;
      console.log("[library-sync]", t.slug, t.modelo, r.changed ? "updated" : r.downloaded ? "new" : "cached");
    } catch (e) {
      console.warn("[library-sync] fail", t.url, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  documents = [...byUrl.values()];
  saveLibraryHashes(hashes);
  saveCatalogHashes(hashes);
  saveLibrary(documents, { downloaded, changed, skipped, targets: targets.length });
  syncLibraryToCatalogIndex(documents, { downloaded, changed, skipped, targets: targets.length });

  const families = buildAllFamilies();
  const pdfByFam = new Map<string, number>();
  for (const d of documents) {
    if (d.familiaKey) pdfByFam.set(d.familiaKey, (pdfByFam.get(d.familiaKey) ?? 0) + 1);
  }
  for (const f of families) f.pdfs = pdfByFam.get(f.familiaKey) ?? 0;
  fs.writeFileSync(PATHS.familiesTarget, JSON.stringify({ geradoEm: new Date().toISOString(), totalFamilias: families.length, familias: families }, null, 2), "utf8");

  const records: ManufacturerRecord[] = [];
  const { PDFParse } = await import("pdf-parse");
  for (const d of documents) {
    const dest = libraryFileDest(d.localPath);
    if (!fs.existsSync(dest)) continue;
    try {
      const parser = new PDFParse({ data: fs.readFileSync(dest) });
      const text = (await parser.getText()).text ?? "";
      await parser.destroy();
      const rec = parsePdfSpecText(text, d.marca, d.modelo, d.url, d.ano ?? undefined);
      if (rec) records.push(rec);
    } catch {}
  }
  fs.writeFileSync(PATHS.rawCatalogsParsed, JSON.stringify({ geradoEm: new Date().toISOString(), source: "document-library", records }, null, 2), "utf8");

  console.log(
    JSON.stringify({
      pdfs: documents.length,
      familias: families.length,
      comPdf: families.filter((f) => f.pdfs > 0).length,
      downloaded,
      changed,
      skipped,
      parsed: records.length,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});