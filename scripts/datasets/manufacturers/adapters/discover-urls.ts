import fs from "fs";
import path from "path";
import type { BrandAdapterConfig, HtmlPageSeed } from "./types.js";

const UA = "consulta-tabela-fipe/1.0 (dados-publicos; OEM discovery)";
const EXCLUDE = /login|dealer|concession|contato|politica|privacidade|cookie|newsletter|instagram|facebook|linkedin|youtube|careers|recall|pecas|pos-venda|financ|seguro|test-?drive|agende|whatsapp/i;

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(35000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return await res.text();
}

function sameHost(a: URL, b: URL): boolean {
  return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");
}

function guessModelo(href: string): string {
  const parts = href.replace(/\?.*$/, "").replace(/#.*$/, "").split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "modelo";
  const base = last.replace(/\.(html?|aspx)$/i, "").replace(/^peugeot-/, "");
  return base.split(/[-_]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function scoreLink(href: string, slug: string): number {
  const h = href.toLowerCase();
  let s = 0;
  if (/model|veicul|carro|gama|all-models|models|picape|suv|crossover|serie|series/i.test(h)) s += 2;
  if (/\.(html?|aspx)$/i.test(h) || /\/$/.test(h)) s += 1;
  if (slug === "kia" && !h.includes("/carros/")) s += 1;
  if (slug === "byd" && h.includes("/car/")) s += 2;
  if (slug === "renault" && h.includes("veiculos-de-passeio")) s += 2;
  if (EXCLUDE.test(h)) s -= 10;
  if (/\.pdf(\?|$)/i.test(h)) s -= 5;
  return s;
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const found = new Set<string>();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1].trim();
    if (!href || href.indexOf("javascript") === 0 || href.indexOf("mailto") === 0) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (!sameHost(abs, base)) continue;
      if (abs.pathname.toLowerCase() === base.pathname.toLowerCase()) continue;
      if (EXCLUDE.test(abs.pathname + abs.search)) continue;
      found.add(abs.toString().split("#")[0]);
    } catch {}
  }
  return [...found];
}

function dedupeSeeds(seeds: HtmlPageSeed[]): HtmlPageSeed[] {
  const map = new Map<string, HtmlPageSeed>();
  for (const s of seeds) {
    const key = s.url.replace(/\/$/, "").toLowerCase();
    if (!map.has(key)) map.set(key, s);
  }
  return [...map.values()];
}

export async function discoverBrandUrls(config: BrandAdapterConfig): Promise<HtmlPageSeed[]> {
  if (!config.discoveryBaseUrl) return [];
  const html = await fetchHtml(config.discoveryBaseUrl);
  const links = extractLinks(html, config.discoveryBaseUrl);
  const scored = links
    .map((url) => ({ url, score: scoreLink(url, config.slug) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
  return dedupeSeeds(scored.map(({ url }) => ({ url, modelo: guessModelo(url), ano: new Date().getFullYear() })));
}

interface AdaptersFile { version: number; legacyHtmlSlugs: string[]; brands: BrandAdapterConfig[]; }

export async function discoverAllBrands(slugs?: string[]): Promise<Record<string, HtmlPageSeed[]>> {
  const file = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "sources", "manufacturer-adapters.json"), "utf8"),
  ) as AdaptersFile;
  const out: Record<string, HtmlPageSeed[]> = {};
  for (const brand of file.brands) {
    if (!brand.autoDiscover || !brand.discoveryBaseUrl) continue;
    if (slugs?.length && !slugs.includes(brand.slug)) continue;
    try {
      out[brand.slug] = await discoverBrandUrls(brand);
      console.log("[discover]", brand.slug, out[brand.slug].length);
    } catch (e) {
      console.warn("[discover]", brand.slug, (e as Error).message);
      out[brand.slug] = [];
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return out;
}

async function main() {
  const slugArg = process.argv.find((a) => a.startsWith("--brand="))?.split("=")[1];
  const slugs = slugArg ? slugArg.split(",") : undefined;
  const discovered = await discoverAllBrands(slugs);
  const dest = path.join(process.cwd(), "data", "raw", "manufacturers", "discovered-urls.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify({ geradoEm: new Date().toISOString(), seeds: discovered }, null, 2), "utf8");
  console.log(JSON.stringify({ marcas: Object.keys(discovered).length }, null, 2));
}

const isMain = process.argv[1] && process.argv[1].endsWith("discover-urls.ts");
if (isMain) main().catch((e) => {
  console.error(e);
  process.exit(1);
});

