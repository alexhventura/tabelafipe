import fs from "fs";
import { PATHS } from "../lib/fipe-paths.js";
import { baseModelSlug } from "../lib/enrichment/generation-match.js";
import { marcaSlug } from "../lib/fipe-slug.js";

type Vehicle = { marca: string; ano: number; modeloSlug: string };
type Generation = { id: string; numero: number; anoInicio: number; anoFim: number; label: string };
type Family = { marca: string; modeloFamilia: string; geracoes: Generation[] };

function clusterYears(years: number[]): Array<{ anoInicio: number; anoFim: number }> {
  const ys = [...new Set(years)].sort((a, b) => a - b);
  if (!ys.length) return [];
  const clusters: Array<{ anoInicio: number; anoFim: number }> = [];
  let start = ys[0];
  let prev = ys[0];
  for (let i = 1; i < ys.length; i++) {
    const y = ys[i];
    if (y - prev > 1) { clusters.push({ anoInicio: start, anoFim: prev }); start = y; }
    prev = y;
  }
  clusters.push({ anoInicio: start, anoFim: prev });
  return clusters;
}

function buildFamily(marca: string, familia: string, years: number[]): Family {
  const clusters = clusterYears(years);
  const geracoes = clusters.map((c, idx) => ({
    id: familia + "-" + (idx + 1),
    numero: idx + 1,
    anoInicio: c.anoInicio,
    anoFim: c.anoFim,
    label: familia.toUpperCase() + " gen " + (idx + 1) + " (" + c.anoInicio + "-" + c.anoFim + ")",
  }));
  return { marca, modeloFamilia: familia, geracoes };
}

function mergeFamilies(existing: Family[], generated: Family[]): Family[] {
  const map = new Map<string, Family>();
  for (const f of generated) map.set(marcaSlug(f.marca) + "|" + f.modeloFamilia, f);
  for (const f of existing) {
    const key = marcaSlug(f.marca) + "|" + f.modeloFamilia;
    const cur = map.get(key);
    if (!cur || f.geracoes.length > cur.geracoes.length) map.set(key, f);
  }
  return [...map.values()];
}

function main() {
  const vehicles = JSON.parse(fs.readFileSync(PATHS.normalizedVeiculos, "utf8")) as Vehicle[];
  const groups = new Map<string, { marca: string; familia: string; years: number[]; count: number }>();
  for (const v of vehicles) {
    const familia = baseModelSlug(v.modeloSlug);
    const key = marcaSlug(v.marca) + "|" + familia;
    const g = groups.get(key) ?? { marca: v.marca, familia, years: [], count: 0 };
    g.years.push(v.ano);
    g.count++;
    groups.set(key, g);
  }
  const ranked = [...groups.values()].filter((g) => g.count >= 2).sort((a, b) => b.count - a.count);
  const selected = ranked;
  
  const generated: Family[] = selected.map((g) => buildFamily(g.marca, g.familia, g.years));
  const existing = fs.existsSync(PATHS.generationsCatalog)
    ? ((JSON.parse(fs.readFileSync(PATHS.generationsCatalog, "utf8")) as { modelos?: Family[] }).modelos ?? [])
    : [];
  const modelos = mergeFamilies(existing, generated);
  const totalGeracoes = modelos.reduce((s, m) => s + m.geracoes.length, 0);
  const out = { geradoEm: new Date().toISOString(), stats: { totalFamilias: modelos.length, totalGeracoes }, modelos };
  fs.writeFileSync(PATHS.generationsCatalog, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out.stats, null, 2));
}

main();
