import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PATHS } from "./fipe-paths.js";
import { normalizeText } from "./enrichment/matching-engine.js";
import { marcaSlug } from "./fipe-slug.js";
import { baseModelSlug } from "./enrichment/generation-match.js";

export interface CatalogIndexEntry {
  marca: string;
  modelo: string;
  ano: number | null;
  pdf: string;
  localPath: string;
  hash: string;
  captured_at: string;
  familiaKey?: string;
  tipo?: string;
}

export interface FamilyTarget {
  familiaKey: string;
  marca: string;
  modeloFamilia: string;
  totalVeiculos: number;
  anoMin: number;
  anoMax: number;
  pdfs: number;
}

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function loadIndex(): CatalogIndexEntry[] {
  if (!fs.existsSync(PATHS.catalogIndex)) return [];
  const data = JSON.parse(fs.readFileSync(PATHS.catalogIndex, "utf8"));
  return data.entradas ?? data.entries ?? [];
}

export function loadHashes(): Record<string, string> {
  if (!fs.existsSync(PATHS.catalogIndexHashes)) return {};
  return JSON.parse(fs.readFileSync(PATHS.catalogIndexHashes, "utf8"));
}

export function saveIndex(entradas: CatalogIndexEntry[], meta?: Record<string, unknown>) {
  fs.mkdirSync(PATHS.catalogIndexRoot, { recursive: true });
  fs.writeFileSync(PATHS.catalogIndex, JSON.stringify({ geradoEm: new Date().toISOString(), total: entradas.length, ...meta, entradas }, null, 2), "utf8");
}

export function saveHashes(hashes: Record<string, string>) {
  fs.mkdirSync(PATHS.catalogIndexRoot, { recursive: true });
  fs.writeFileSync(PATHS.catalogIndexHashes, JSON.stringify(hashes, null, 2), "utf8");
}

export function localPdfPath(slug: string, url: string): string {
  const base = url.split("/").pop()?.split("?")[0] ?? "catalogo.pdf";
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return path.join(slug, safe.endsWith(".pdf") ? safe : safe + ".pdf");
}

export function matchFamiliaKey(marca: string, modeloHint: string): string | undefined {
  const hint = normalizeText(modeloHint).replace(/[^a-z0-9]/g, "");
  if (!hint) return undefined;
  return marcaSlug(marca) + "|" + baseModelSlug(hint);
}

export function buildAllFamilies(): FamilyTarget[] {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const vehicles = JSON.parse(fs.readFileSync(file, "utf8")) as { marca: string; modeloSlug: string; ano: number }[];
  const groups = new Map<string, FamilyTarget>();
  for (const v of vehicles) {
    const familia = baseModelSlug(v.modeloSlug);
    const key = marcaSlug(v.marca) + "|" + familia;
    const g = groups.get(key) ?? { familiaKey: key, marca: v.marca, modeloFamilia: familia, totalVeiculos: 0, anoMin: v.ano, anoMax: v.ano, pdfs: 0 };
    g.totalVeiculos++;
    g.anoMin = Math.min(g.anoMin, v.ano);
    g.anoMax = Math.max(g.anoMax, v.ano);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.totalVeiculos - a.totalVeiculos);
}
