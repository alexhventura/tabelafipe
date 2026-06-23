import fs from "fs";
import path from "path";
import { PATHS } from "../../lib/fipe-paths.js";
import { fetchHtml, extractLinks } from "../manufacturers/adapters/discover-urls.js";

type PdfEntry = { url: string; modelo?: string; ano?: number; tipo?: string };
type BrandManifest = { slug: string; pdfs: PdfEntry[] };

interface AdaptersFile { brands: Array<{ slug: string; nome: string; discoveryBaseUrl?: string; autoDiscover?: boolean; pdfCatalogs?: PdfEntry[] }>; }

function guessModelFromPdf(url: string): string {
  const name = url.split("/").pop()?.replace(/\.pdf.*$/i, "") ?? "catalogo";
  return name.replace(/[_-]+/g, " ").replace(/catalogo/gi, "").trim() || "Catalogo";
}

function extractPdfLinks(html: string, baseUrl: string): string[] {
  return extractLinks(html, baseUrl).filter((u) => /\.pdf(\?|$)/i.test(u));
}

async function discoverBrandPdfs(slug: string, baseUrl: string): Promise<PdfEntry[]> {
  const out: PdfEntry[] = [];
  try {
    const html = await fetchHtml(baseUrl);
    for (const url of extractPdfLinks(html, baseUrl)) {
      out.push({ url, modelo: guessModelFromPdf(url), ano: new Date().getFullYear(), tipo: "catalogo" });
    }
  } catch (e) {
    console.warn("[catalog-discover]", slug, (e as Error).message);
  }
  return out;
}

async function trySitemap(host: string): Promise<string[]> {
  const candidates = [host.replace(/\/$/, "") + "/sitemap.xml", host.replace(/\/$/, "") + "/sitemap_index.xml"];
  const pdfs: string[] = [];
  for (const url of candidates) {
    try {
      const xml = await fetchHtml(url);
      const re = /<loc>([^<]+\.pdf[^<]*)<\/loc>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml))) pdfs.push(m[1].trim());
    } catch {}
  }
  return pdfs;
}

async function main() {
  const adapters = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "sources", "manufacturer-adapters.json"), "utf8")) as AdaptersFile;
  const marcas: BrandManifest[] = [];
  for (const brand of adapters.brands) {
    const pdfs: PdfEntry[] = [];
    for (const p of brand.pdfCatalogs ?? []) pdfs.push({ ...p, tipo: p.tipo ?? "catalogo" });
    if (brand.discoveryBaseUrl) {
      pdfs.push(...(await discoverBrandPdfs(brand.slug, brand.discoveryBaseUrl)));
      const hostPdfs = await trySitemap(brand.discoveryBaseUrl);
      for (const url of hostPdfs) pdfs.push({ url, modelo: guessModelFromPdf(url), ano: new Date().getFullYear(), tipo: "sitemap" });
    }
    const dedup = new Map<string, PdfEntry>();
    for (const p of pdfs) dedup.set(p.url.split("#")[0], p);
    marcas.push({ slug: brand.slug, pdfs: [...dedup.values()] });
    console.log("[catalog-discover]", brand.slug, dedup.size);
    await new Promise((r) => setTimeout(r, 350));
  }
  fs.mkdirSync(PATHS.rawCatalogs, { recursive: true });
  const manifest = { geradoEm: new Date().toISOString(), marcas };
  fs.writeFileSync(PATHS.catalogsManifest, JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify({ marcas: marcas.length, pdfs: marcas.reduce((s, m) => s + m.pdfs.length, 0) }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
