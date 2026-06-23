/**
 * Identificador universal cross-fonte.
 */
import { combustivelSlug, marcaSlug } from '../fipe-slug.js';
import { normalizeVersao } from './matching-engine.js';

export function buildVehicleUid(marca: string, modelo: string, ano: number, combustivel: string, versao?: string): string {
  const v = (versao ?? normalizeVersao(modelo)).replace(/\s+/g, '-').slice(0, 80);
  return ['v1', marcaSlug(marca), v || 'base', String(ano), combustivelSlug(combustivel)].join(':');
}