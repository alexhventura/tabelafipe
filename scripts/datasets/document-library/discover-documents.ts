/**
 * Descobre URLs candidatas e registra todas as familias como alvos.
 */
import fs from "fs";
import path from "path";
import { PATHS } from "../../lib/fipe-paths.js";
import { buildAllFamilies } from "../../lib/catalog-index.js";
import { matchFamiliaKey } from "../../lib/catalog-index.js";
import { fetchHtml, extractLinks } from "../manufacturers/adapters/discover-urls.js";

type PdfEntry = { url: string; modelo?: string; ano?: number; tipo?: string };
type BrandManifest = { slug: string; pdfs: PdfEntry[] };
interface AdaptersFile {
  brands: Array<{ slug: string; nome: string; discoveryBaseUrl?: string; pdfCatalogs?: PdfEntry[] }>;
}

export type DiscoveryTarget = {
  familiaKey: string;
  marca: string;
  modeloFamilia: string;
  totalVeiculos: number;
  candidateUrls: string[];
  status: "pending" | "has-candidates";
};

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
    console.warn("[library-discover]", slug, (e as Error).message);
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

function normalizeHint(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function urlsForFamily(familiaKey: string, marca: string, modeloFamilia: string, brandPdfs: Map<string, PdfEntry[]>): string[] {
  const famNorm = normalizeHint(modeloFamilia);
  const urls: string[] = [];
  for (const [slug, pdfs] of brandPdfs) {
    for (const p of pdfs) {
      const hint = normalizeHint(p.modelo ?? guessModelFromPdf(p.url));
      const key = matchFamiliaKey(marca, p.modelo ?? "");
      if (key === familiaKey || (famNorm && hint.includes(famNorm)) || (famNorm && famNorm.includes(hint.slice(0, Math.min(4, hint.length))))) {
        urls.push(p.url.split("#")[0]);
      }
    }
  }
  return [...new Set(urls)];
}

async function collectBrandPdfs(adapters: AdaptersFile): Promise<Map<string, PdfEntry[]>> {
  const brandPdfs = new Map<string, PdfEntry[]>();
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
    brandPdfs.set(brand.slug, [...dedup.values()]);
    console.log("[library-discover]", brand.slug, dedup.size);
    await new Promise((r) => setTimeout(r, 350));
  }
  return brandPdfs;
}

async function main() {
  const adaptersPath = path.join(process.cwd(), "data", "sources", "manufacturer-adapters.json");
  const adapters = JSON.parse(fs.readFileSync(adaptersPath, "utf8")) as AdaptersFile;
  const brandPdfs = await collectBrandPdfs(adapters);

  const familiesFile = fs.existsSync(PATHS.familiesTarget)
    ? (JSON.parse(fs.readFileSync(PATHS.familiesTarget, "utf8")) as { familias?: ReturnType<typeof buildAllFamilies> }).familias
    : undefined;
  const families = familiesFile?.length ? familiesFile : buildAllFamilies();

  const targets: DiscoveryTarget[] = families.map((f) => {
    const candidateUrls = urlsForFamily(f.familiaKey, f.marca, f.modeloFamilia, brandPdfs);
    return {
      familiaKey: f.familiaKey,
      marca: f.marca,
      modeloFamilia: f.modeloFamilia,
      totalVeiculos: f.totalVeiculos,
      candidateUrls,
      status: candidateUrls.length ? "has-candidates" : "pending",
    };
  });

  const queuePath = path.join(PATHS.documentLibraryRoot, "discovery-queue.json");
  fs.mkdirSync(PATHS.documentLibraryRoot, { recursive: true });
  fs.writeFileSync(
    queuePath,
    JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        totalFamilias: families.length,
        comCandidatos: targets.filter((t) => t.candidateUrls.length).length,
        targets,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify({
      familias: families.length,
      comCandidatos: targets.filter((t) => t.candidateUrls.length).length,
      pdfsDescobertos: brandPdfs.values().reduce((s, arr) => s + arr.length, 0),
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});