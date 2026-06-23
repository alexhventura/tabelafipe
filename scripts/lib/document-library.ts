import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PATHS } from "./fipe-paths.js";
import {
  loadIndex as loadCatalogIndex,
  localPdfPath,
  matchFamiliaKey,
  saveIndex as saveCatalogIndex,
  type CatalogIndexEntry,
} from "./catalog-index.js";

export type DocumentType =
  | "catalog"
  | "brochure"
  | "spec-sheet"
  | "owner-manual"
  | "maintenance-manual"
  | "service-bulletin"
  | "recall-document"
  | "technical-sheet"
  | "maintenance-table"
  | "historical-catalog";

export interface RichnessScore {
  power: boolean;
  torque: boolean;
  dimensions: boolean;
  trunk: boolean;
  maintenance: boolean;
  fluids: boolean;
  richnessScore: number;
}

export interface LibraryDocument {
  id: string;
  marca: string;
  modelo: string;
  ano: number | null;
  url: string;
  localPath: string;
  hash: string;
  type: DocumentType;
  captured_at: string;
  familiaKey?: string;
  richness: RichnessScore;
}

export interface LibraryIndexFile {
  geradoEm: string;
  total: number;
  documents: LibraryDocument[];
}

function docId(url: string, hash: string): string {
  return crypto.createHash("sha1").update(url + "|" + hash).digest("hex").slice(0, 16);
}

export function inferDocumentType(url: string, filename: string): DocumentType {
  const s = (url + " " + filename).toLowerCase();
  if (/recall|campanha|chamamento/.test(s)) return "recall-document";
  if (/boletim|service.?bulletin|tsb/.test(s)) return "service-bulletin";
  if (/manual.*(propriet|owner|usuario)|owner.?manual/.test(s)) return "owner-manual";
  if (/manual.*(manut|service|oficina)/.test(s)) return "maintenance-manual";
  if (/ficha|spec|technical|tecnica/.test(s)) return "spec-sheet";
  if (/brochure|folder|folheto/.test(s)) return "brochure";
  if (/catalogo|catalog|digital/.test(s)) return "catalog";
  if (/tabela.*manut|maintenance.?table|planilha.*revis/.test(s)) return "maintenance-table";
  if (/historico|historical|linha.?do.?tempo|my\d{2}/.test(s)) return "historical-catalog";
  if (/technical.?sheet|datasheet/.test(s)) return "technical-sheet";
  if (/\.pdf/.test(s)) return "catalog";
  return "technical-sheet";
}

export function scoreRichnessFromText(text: string): RichnessScore {
  const t = text.replace(/\s+/g, " ");
  const power = /pot[eê]ncia|cv\b|hp\b|cavalos/i.test(t);
  const torque = /torque|kgf\.?m|nm\b|newton/i.test(t);
  const dimensions = /dimens[oõ]es|comprimento|largura|altura|entre.?eixos/i.test(t);
  const trunk = /porta.?malas|bagageiro|volume\s*(util|de\s*carga)/i.test(t);
  const maintenance = /manuten[cç][aã]o|revis[aã]o|oleo|lubrificante|filtro/i.test(t);
  const fluids = /fluido|arrefecimento|freio|dot\s*\d|refrigerante/i.test(t);
  const flags = [power, torque, dimensions, trunk, maintenance, fluids];
  const richnessScore = flags.filter(Boolean).length;
  return { power, torque, dimensions, trunk, maintenance, fluids, richnessScore };
}

export function loadLibrary(): LibraryDocument[] {
  if (!fs.existsSync(PATHS.documentLibraryIndex)) return [];
  const data = JSON.parse(fs.readFileSync(PATHS.documentLibraryIndex, "utf8")) as LibraryIndexFile;
  return data.documents ?? [];
}

export function loadLibraryHashes(): Record<string, string> {
  if (!fs.existsSync(PATHS.documentLibraryHashes)) return {};
  return JSON.parse(fs.readFileSync(PATHS.documentLibraryHashes, "utf8"));
}

export function saveLibraryHashes(hashes: Record<string, string>) {
  fs.mkdirSync(PATHS.documentLibraryRoot, { recursive: true });
  fs.writeFileSync(PATHS.documentLibraryHashes, JSON.stringify(hashes, null, 2), "utf8");
}

export function saveLibrary(documents: LibraryDocument[], meta?: Record<string, unknown>) {
  fs.mkdirSync(PATHS.documentLibraryRoot, { recursive: true });
  const payload: LibraryIndexFile = {
    geradoEm: new Date().toISOString(),
    total: documents.length,
    documents,
    ...(meta as object),
  };
  fs.writeFileSync(PATHS.documentLibraryIndex, JSON.stringify(payload, null, 2), "utf8");
}

export function libraryDocToCatalogEntry(doc: LibraryDocument): CatalogIndexEntry {
  return {
    marca: doc.marca,
    modelo: doc.modelo,
    ano: doc.ano,
    pdf: doc.url,
    localPath: doc.localPath,
    hash: doc.hash,
    captured_at: doc.captured_at,
    familiaKey: doc.familiaKey,
    tipo: doc.type,
  };
}

export function catalogEntryToLibraryDoc(entry: CatalogIndexEntry): LibraryDocument {
  const filename = path.basename(entry.localPath);
  const type = inferDocumentType(entry.pdf, filename);
  return {
    id: docId(entry.pdf, entry.hash),
    marca: entry.marca,
    modelo: entry.modelo,
    ano: entry.ano,
    url: entry.pdf,
    localPath: entry.localPath,
    hash: entry.hash,
    type,
    captured_at: entry.captured_at,
    familiaKey: entry.familiaKey ?? matchFamiliaKey(entry.marca, entry.modelo),
    richness: { power: false, torque: false, dimensions: false, trunk: false, maintenance: false, fluids: false, richnessScore: 0 },
  };
}

export function migrateFromCatalogIndex(): LibraryDocument[] {
  const existing = loadLibrary();
  const byUrl = new Map(existing.map((d) => [d.url.split("#")[0], d]));
  for (const entry of loadCatalogIndex()) {
    const url = entry.pdf.split("#")[0];
    if (!byUrl.has(url)) byUrl.set(url, catalogEntryToLibraryDoc(entry));
  }
  return [...byUrl.values()];
}

export function libraryLocalPath(slug: string, url: string): string {
  return localPdfPath(slug, url);
}

export function libraryFileDest(localPath: string): string {
  return path.join(PATHS.documentLibraryFiles, localPath);
}

export function catalogPdfDest(localPath: string): string {
  return path.join(PATHS.catalogIndexPdfs, localPath);
}

export function syncLibraryToCatalogIndex(documents: LibraryDocument[], meta?: Record<string, unknown>) {
  const entradas = documents.map(libraryDocToCatalogEntry);
  saveCatalogIndex(entradas, { source: "document-library", ...meta });
  for (const doc of documents) {
    const src = libraryFileDest(doc.localPath);
    const dest = catalogPdfDest(doc.localPath);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
    }
  }
}