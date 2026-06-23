import fs from 'fs';
import { PATHS } from '../fipe-paths.js';
import { marcaSlug } from '../fipe-slug.js';

export interface ModelGeneration {
  id: string;
  numero: number;
  anoInicio: number;
  anoFim: number;
  label: string;
}

export interface ModelFamily {
  marca: string;
  modeloFamilia: string;
  geracoes: ModelGeneration[];
}

let cache: Map<string, ModelFamily> | null = null;

/** Primeiro token do modelo (ex.: corolla-altis -> corolla) para casar com modeloFamilia. */
export function baseModelSlug(modeloSlug: string): string {
  return modeloSlug.split('-')[0]?.toLowerCase() || modeloSlug.toLowerCase();
}

function familyKey(marca: string, modeloSlug: string): string {
  return marcaSlug(marca) + '|' + baseModelSlug(modeloSlug);
}

export function loadGenerationsCatalog(file = PATHS.generationsCatalog): Map<string, ModelFamily> {
  if (cache) return cache;
  cache = new Map();
  if (!fs.existsSync(file)) return cache;
  const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as { modelos: ModelFamily[] };
  for (const m of data.modelos) {
    cache.set(familyKey(m.marca, m.modeloFamilia), m);
  }
  return cache;
}

export function resolveGeneration(
  marca: string,
  modeloSlug: string,
  ano: number,
  catalog?: Map<string, ModelFamily>,
): ModelGeneration | null {
  const fam = (catalog ?? loadGenerationsCatalog()).get(familyKey(marca, modeloSlug));
  if (!fam) return null;
  return fam.geracoes.find((g) => ano >= g.anoInicio && ano <= g.anoFim) ?? null;
}

export function sameGeneration(
  marca: string,
  modeloSlug: string,
  anoA: number,
  anoB: number,
  catalog?: Map<string, ModelFamily>,
): boolean {
  const ga = resolveGeneration(marca, modeloSlug, anoA, catalog);
  const gb = resolveGeneration(marca, modeloSlug, anoB, catalog);
  return !!ga && !!gb && ga.id === gb.id;
}