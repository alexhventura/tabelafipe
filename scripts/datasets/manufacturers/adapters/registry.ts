import fs from "fs";
import path from "path";
import { PATHS } from "../../../lib/fipe-paths.js";
import type { ManufacturerRecord } from "../../../lib/enrichment/manufacturer-record.js";
import { BRAND_MODEL_PAGES, fetchModelPages } from "./parse-spec-html.js";
import { fetchPdfCatalogs } from "./pdf-catalog.js";
import { discoverBrandUrls } from "./discover-urls.js";
import type { BrandAdapter, BrandAdapterConfig, CrawlOptions, CrawlResult, HtmlPageSeed } from "./types.js";

interface AdaptersFile { version: number; legacyHtmlSlugs: string[]; brands: BrandAdapterConfig[]; }
function loadAdapterConfigs(): AdaptersFile {
  const file = path.join(process.cwd(), "data", "sources", "manufacturer-adapters.json");
  if (!fs.existsSync(file)) return { version: 1, legacyHtmlSlugs: [], brands: [] };
  return JSON.parse(fs.readFileSync(file, "utf8")) as AdaptersFile;
}
function toRecord(row: ManufacturerRecord, adapterId: string): ManufacturerRecord { return { ...row, adapterId: row.adapterId ?? adapterId }; }
function mergePages(configured: HtmlPageSeed[] = [], discovered: HtmlPageSeed[] = []): HtmlPageSeed[] {
  const map = new Map<string, HtmlPageSeed>();
  for (const p of [...configured, ...discovered]) {
    const key = p.url.replace(/\/$/, "").toLowerCase();
    if (!map.has(key)) map.set(key, p);
  }
  return [...map.values()];
}
function loadParsedPdfBySlug(): Map<string, ManufacturerRecord[]> {
  const map = new Map<string, ManufacturerRecord[]>();
  if (!fs.existsSync(PATHS.rawCatalogsParsed)) return map;
  const raw = JSON.parse(fs.readFileSync(PATHS.rawCatalogsParsed, "utf8")) as { records?: ManufacturerRecord[] };
  for (const r of raw.records ?? []) {
    const slug = r.adapterId ?? "unknown";
    (map.get(slug) ?? map.set(slug, []).get(slug)!).push(r);
  }
  return map;
}
function buildAdapter(config: BrandAdapterConfig): BrandAdapter {
  return { ...config, async crawl(options?: CrawlOptions) {
    const out: ManufacturerRecord[] = [];
    const shouldDiscover = options?.discover || !(config.htmlPages?.length);
    let htmlPages = config.htmlPages ?? [];
    if (shouldDiscover && config.autoDiscover && config.discoveryBaseUrl) {
      try { htmlPages = mergePages(htmlPages, await discoverBrandUrls(config)); }
      catch (e) { console.warn("discover " + config.slug, (e as Error).message); }
    } else { htmlPages = mergePages(htmlPages); }
    if (config.pdfCatalogs?.length) out.push(...(await fetchPdfCatalogs(config.nome, config.pdfCatalogs, config.slug)));
    if (htmlPages.length) {
      const legacy = BRAND_MODEL_PAGES[config.slug];
      const nome = legacy?.nome ?? config.nome;
      const pages = htmlPages.map((p) => ({ url: p.url, modelo: p.modelo, ano: p.ano }));
      const rows = await fetchModelPages(config.slug, nome, pages);
      for (const r of rows) out.push(toRecord({ marca: r.marca, modelo: r.modelo, ano: r.ano, potenciaCv: r.potenciaCv, torqueNm: r.torqueNm, cambio: r.cambio, portaMalasL: r.portaMalasL, tanqueL: r.tanqueL, fonte: r.fonte, urlFonte: r.urlFonte, capturadoEm: r.capturadoEm }, config.slug));
    }
    return out;
  } };
}
function buildLegacyAdapter(slug: string): BrandAdapter | null {
  const brand = BRAND_MODEL_PAGES[slug];
  if (!brand) return null;
  return { slug, nome: brand.nome, strategy: "html", htmlPages: brand.pages.map((p) => ({ url: p.url, modelo: p.modelo, ano: p.ano })),
    async crawl() {
      const rows = await fetchModelPages(slug, brand.nome, brand.pages);
      return rows.map((r) => toRecord({ marca: r.marca, modelo: r.modelo, ano: r.ano, potenciaCv: r.potenciaCv, torqueNm: r.torqueNm, cambio: r.cambio, portaMalasL: r.portaMalasL, tanqueL: r.tanqueL, fonte: r.fonte, urlFonte: r.urlFonte, capturadoEm: r.capturadoEm }, slug));
    },
  };
}
const ADAPTER_MAP = new Map<string, BrandAdapter>();
function ensureRegistry(): void {
  if (ADAPTER_MAP.size) return;
  const file = loadAdapterConfigs();
  for (const slug of file.legacyHtmlSlugs) { const a = buildLegacyAdapter(slug); if (a) ADAPTER_MAP.set(slug, a); }
  for (const cfg of file.brands) ADAPTER_MAP.set(cfg.slug, buildAdapter(cfg));
}
export function getAllAdapters(): BrandAdapter[] { ensureRegistry(); return [...ADAPTER_MAP.values()]; }
export function getAdapter(slug: string): BrandAdapter | undefined { ensureRegistry(); return ADAPTER_MAP.get(slug); }
export async function crawlAllAdapters(slugs?: string[], options?: CrawlOptions) {
  ensureRegistry();
  const parsedBySlug = loadParsedPdfBySlug();
  const list = slugs?.length ? (slugs.map((s) => ADAPTER_MAP.get(s)).filter(Boolean) as BrandAdapter[]) : getAllAdapters();
  const records = new Map<string, ManufacturerRecord[]>();
  const results: CrawlResult[] = [];
  for (const adapter of list) {
    const rows = await adapter.crawl(options);
    const merged = [...rows, ...(parsedBySlug.get(adapter.slug) ?? [])];
    results.push({ slug: adapter.slug, registros: merged.length, strategy: adapter.strategy });
    records.set(adapter.slug, merged);
    console.log("[" + adapter.slug + "] " + merged.length);
    await new Promise((r) => setTimeout(r, 300));
  }
  return { results, records };
}
