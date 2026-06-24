import type { FamilySearchItem, VehicleTipo } from '../types';
import { formatYearLabel } from './displayYear';
import { formatFamilyDisplay, normalizeText } from './modelFamily';
import { matchesMarcaQuery } from './brandAliases';
import { formatTitleCase } from './display';

export type GuidedStep = 'marca' | 'modelo' | 'versao' | 'ano';

export interface GuidedMarca {
  slug: string;
  nome: string;
  tipo: VehicleTipo;
  totalModelos: number;
  totalVeiculos: number;
}

export interface GuidedVersao {
  fipeCodigo: string;
  label: string;
  displayName: string;
  anos: number[];
  vehicleByAno: Map<number, GuidedVeiculoAno>;
}

export interface GuidedVeiculoAno {
  vehicleId: string;
  ano: number;
  valorAtual: number;
  canonicalPath: string;
  displayName: string;
  fipeCodigo: string;
}

export interface FamilyHubVehicle {
  vehicleId: string;
  fipeCodigo: string;
  displayName: string;
  valorAtual: number;
  canonicalPath: string;
  ano: number;
  marca: string;
}

export interface FamilyHubBundle {
  slug: string;
  titulo?: string;
  veiculos: FamilyHubVehicle[];
}

export function shortenVersionLabel(displayName: string, marca: string, familiaDisplay: string): string {
  let label = displayName
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(new RegExp(`^${marca}\\s+`, 'i'), '')
    .trim();

  const familyPrefix = new RegExp(`^${familiaDisplay}\\s+`, 'i');
  label = label.replace(familyPrefix, '').trim();

  if (/^cross\b/i.test(label)) {
    label = `Cross ${label.replace(/^cross\s+/i, '').trim()}`;
  }

  const engineCut = label.match(/^(.+?)\s+\d+\.\d+/);
  if (engineCut) label = engineCut[1].trim();

  const specCut = label.match(/^(.+?)\s+(flex|hibrido|hybrid|diesel|turbo|aut\.?|mec\.?)\b/i);
  if (specCut) label = specCut[1].trim();

  return formatTitleCase(label) || formatTitleCase(displayName);
}

export function groupHubVersions(
  veiculos: FamilyHubVehicle[],
  marcaNome: string,
  familiaDisplay: string,
): GuidedVersao[] {
  const byFipe = new Map<string, GuidedVersao>();

  for (const v of veiculos) {
    if (!v.fipeCodigo || !v.canonicalPath) continue;
    let group = byFipe.get(v.fipeCodigo);
    if (!group) {
      group = {
        fipeCodigo: v.fipeCodigo,
        label: shortenVersionLabel(v.displayName, marcaNome, familiaDisplay),
        displayName: v.displayName.replace(/\s*\(\d{4}\)\s*$/, '').trim(),
        anos: [],
        vehicleByAno: new Map(),
      };
      byFipe.set(v.fipeCodigo, group);
    }
    group.vehicleByAno.set(v.ano, {
      vehicleId: v.vehicleId,
      ano: v.ano,
      valorAtual: v.valorAtual,
      canonicalPath: v.canonicalPath,
      displayName: v.displayName,
      fipeCodigo: v.fipeCodigo,
    });
  }

  const out = [...byFipe.values()];
  for (const g of out) {
    g.anos = [...g.vehicleByAno.keys()].sort((a, b) => b - a);
  }

  out.sort((a, b) => {
    const yearA = a.anos[0] ?? 0;
    const yearB = b.anos[0] ?? 0;
    return yearB - yearA || a.label.localeCompare(b.label, 'pt-BR');
  });

  return out;
}

export function formatGuidedYear(ano: number): string {
  return formatYearLabel(ano);
}

export function filterMarcas(marcas: GuidedMarca[], query: string): GuidedMarca[] {
  const q = normalizeText(query);
  if (!q) return marcas;
  return marcas.filter((m) => matchesMarcaQuery(q, m.slug, m.nome));
}

export function filterFamilies(families: FamilySearchItem[], query: string): FamilySearchItem[] {
  const q = normalizeText(query);
  if (!q) return families;
  return families.filter(
    (f) =>
      normalizeText(f.familiaDisplay).includes(q) ||
      normalizeText(f.familia).includes(q),
  );
}

export function filterVersions(versions: GuidedVersao[], query: string): GuidedVersao[] {
  const q = normalizeText(query);
  if (!q) return versions;
  return versions.filter(
    (v) =>
      normalizeText(v.label).includes(q) ||
      normalizeText(v.displayName).includes(q) ||
      v.fipeCodigo.includes(q),
  );
}

export function familyHubPath(marcaSlug: string, familia: string): string {
  return `/data/hubs/familia/${marcaSlug}/${familia}.json`;
}

export function formatFamilyLabel(family: FamilySearchItem): string {
  return formatFamilyDisplay(family.familiaDisplay || family.familia);
}
