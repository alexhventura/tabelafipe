/**
 * Matching Engine — chaves globais para unificar veiculos entre fontes.
 */
import { combustivelSlug, marcaSlug, slugify } from '../fipe-slug.js';
import type { FipeVehicle, NormalizedVehicle } from './types.js';
import { buildVehicleUid } from './vehicle-uid.js';

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractModelTokens(modelo: string): string[] {
  const cleaned = normalizeText(modelo)
    .replace(/\b(flex|diesel|gasolina|hibrido|eletrico|aut|manual|cvt|at|mt)\b/g, '')
    .replace(/\b\d[\d.,]*\s*(cv|hp|kw|cc|l)\b/g, '')
    .replace(/\b\d{4}\b/g, '')
    .replace(/\b\d+p\b/g, '')
    .trim();
  return cleaned.split(/\s+/).filter((t) => t.length > 1);
}

export function normalizeVersao(modelo: string): string {
  return extractModelTokens(modelo).join(' ');
}

export function primaryMatchKey(marca: string, modelo: string, ano: number, combustivel: string): string {
  return `${marcaSlug(marca)}|${normalizeVersao(modelo)}|${ano}|${combustivelSlug(combustivel)}`;
}

export function familyMatchKey(marca: string, modelo: string, ano: number): string {
  const tokens = extractModelTokens(modelo);
  const familia = tokens.slice(0, 2).join(' ') || normalizeVersao(modelo);
  return `${marcaSlug(marca)}|${familia}|${ano}`;
}

export function inmetroMatchKey(marca: string, modelo: string): string {
  return `${normalizeText(marca)}|${normalizeVersao(modelo)}`;
}

export function manufacturerMatchKey(marca: string, modelo: string, ano: number): string {
  return `${marcaSlug(marca)}|${normalizeVersao(modelo)}|${ano}`;
}

export function buildMatchKeys(marca: string, modelo: string, ano: number, combustivel: string): string[] {
  return [
    primaryMatchKey(marca, modelo, ano, combustivel),
    familyMatchKey(marca, modelo, ano),
    inmetroMatchKey(marca, modelo),
    manufacturerMatchKey(marca, modelo, ano),
  ];
}

export function normalizeVehicle(raw: FipeVehicle): NormalizedVehicle {
  const versaoNormalizada = normalizeVersao(raw.modelo);
  return {
    ...raw,
    vehicleId: raw.id,
    vehicleUid: buildVehicleUid(raw.marca, raw.modelo, raw.ano, raw.combustivel, versaoNormalizada),
    marcaSlug: marcaSlug(raw.marca),
    modeloSlug: slugify(raw.modelo.split(/\s+\d/)[0] || raw.modelo),
    combustivelSlug: combustivelSlug(raw.combustivel),
    versaoNormalizada,
    matchKeys: buildMatchKeys(raw.marca, raw.modelo, raw.ano, raw.combustivel),
  };
}

export function buildMatchIndex(vehicles: NormalizedVehicle[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const v of vehicles) {
    for (const key of v.matchKeys) {
      const list = index.get(key) ?? [];
      list.push(v.vehicleId);
      index.set(key, list);
    }
  }
  return index;
}

export function resolveVehicleId(index: Map<string, string[]>, key: string): string | null {
  return index.get(key)?.[0] ?? null;
}

export function findMatchCollisions(index: Map<string, string[]>): { key: string; ids: string[] }[] {
  const collisions: { key: string; ids: string[] }[] = [];
  for (const [key, ids] of index) {
    const unique = [...new Set(ids)];
    if (unique.length > 1) collisions.push({ key, ids: unique });
  }
  return collisions;
}