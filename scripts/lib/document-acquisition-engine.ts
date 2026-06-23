/**
 * Document Acquisition Engine (DAE) — find documents, not cars.
 */
import fs from "fs";
import path from "path";
import { PATHS } from "./fipe-paths.js";

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

export type AcquisitionQueueTarget = {
  familiaKey: string;
  marca: string;
  modeloFamilia: string;
  totalVeiculos: number;
  candidateUrls: string[];
  status: string;
};

export type AcquisitionQueueFile = {
  geradoEm?: string;
  targets?: AcquisitionQueueTarget[];
};

const QUEUE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function discoveryQueuePath(): string {
  return path.join(PATHS.documentLibraryRoot, "discovery-queue.json");
}

export function classifyDocument(url: string, filename: string, textSnippet?: string): DocumentType {
  const s = (url + " " + filename + " " + (textSnippet ?? "")).toLowerCase();
  if (/recall|campanha|chamamento/.test(s)) return "recall-document";
  if (/boletim|service.?bulletin|tsb/.test(s)) return "service-bulletin";
  if (/manual.*(propriet|owner|usuario)|owner.?manual/.test(s)) return "owner-manual";
  if (/manual.*(manut|service|oficina)|guia.*manut/.test(s)) return "maintenance-manual";
  if (/tabela.*manut|maintenance.?table|planilha.*revis|intervalo.*revis/.test(s)) return "maintenance-table";
  if (/historico|historical|linha.?do.?tempo|catalogo.*\d{4}/.test(s)) return "historical-catalog";
  if (/ficha|spec.?sheet|especificac/.test(s)) return "spec-sheet";
  if (/brochure|folder|folheto/.test(s)) return "brochure";
  if (/catalogo|catalog|digital/.test(s)) return "catalog";
  if (/technical.?sheet|datasheet|ficha.?tecnica/.test(s)) return "technical-sheet";
  if (/\.pdf/.test(s)) return "catalog";
  return "technical-sheet";
}

const TYPE_PRIORITY: Record<DocumentType, number> = {
  "spec-sheet": 100,
  "maintenance-manual": 98,
  "maintenance-table": 92,
  "technical-sheet": 88,
  "owner-manual": 85,
  "service-bulletin": 82,
  "recall-document": 80,
  "historical-catalog": 78,
  brochure: 70,
  catalog: 65,
};

export function priorityScore(type: DocumentType, richnessScore: number): number {
  const base = TYPE_PRIORITY[type] ?? 60;
  const bonus = Math.min(12, Math.max(0, richnessScore) * 2);
  return Math.round((base + bonus) * 100) / 100;
}

export function loadAcquisitionQueue(): AcquisitionQueueFile {
  const queuePath = discoveryQueuePath();
  if (!fs.existsSync(queuePath)) return { targets: [] };
  return JSON.parse(fs.readFileSync(queuePath, "utf8")) as AcquisitionQueueFile;
}

export function countCandidateUrls(queue: AcquisitionQueueFile = loadAcquisitionQueue()): number {
  let n = 0;
  for (const t of queue.targets ?? []) n += (t.candidateUrls ?? []).length;
  return n;
}

export function isQueueStale(queue: AcquisitionQueueFile = loadAcquisitionQueue()): boolean {
  if (!queue.geradoEm) return true;
  const age = Date.now() - Date.parse(queue.geradoEm);
  return !Number.isFinite(age) || age > QUEUE_STALE_MS;
}

export function appendAcquisitionLog(entry: Record<string, unknown>) {
  fs.mkdirSync(PATHS.documentLibraryRoot, { recursive: true });
  let log: { runs: Record<string, unknown>[] } = { runs: [] };
  if (fs.existsSync(PATHS.documentAcquisitionLog)) {
    log = JSON.parse(fs.readFileSync(PATHS.documentAcquisitionLog, "utf8")) as { runs: Record<string, unknown>[] };
  }
  log.runs.push({ ...entry, logged_at: new Date().toISOString() });
  if (log.runs.length > 400) log.runs = log.runs.slice(-400);
  fs.writeFileSync(PATHS.documentAcquisitionLog, JSON.stringify(log, null, 2), "utf8");
}