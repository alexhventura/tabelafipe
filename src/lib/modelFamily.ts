/** Utilitários compartilhados para extração de família/modelo na busca. */

export const MODEL_NOISE_WORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'e', 'a', 'o', 'flex', 'gasolina', 'diesel',
  'hibrido', 'hybrid', 'aut', 'mec', 'semi', 'super', 'sport', 'sedan', 'mpi',
  'fire', 'turbo', 'cv', '8v', '16v', '4p', '5p', '2p', '4x4', 'moto', 'caminhao',
]);

export const MODEL_LEADING_SKIP = new Set(['grand', 'new', 'novo', 'mini', 'all']);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function modeloTokens(modelo: string): string[] {
  return normalizeText(modelo)
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !MODEL_NOISE_WORDS.has(w) && !/^\d+$/.test(w));
}

/** Nome da família (Corolla, Siena, SW4) a partir do modelo FIPE. */
export function extractFamilyName(modelo: string): string {
  const tokens = modeloTokens(modelo);
  let i = 0;
  while (i < tokens.length && MODEL_LEADING_SKIP.has(tokens[i])) i++;
  return tokens[i] ?? tokens[0] ?? normalizeText(modelo).split(/\s+/)[0] ?? '';
}

export function formatFamilyDisplay(familia: string): string {
  if (!familia) return '';
  if (/^sw\d+$/i.test(familia)) return familia.toUpperCase();
  if (familia.length <= 4 && /^[a-z0-9]+$/i.test(familia)) {
    return familia.toUpperCase();
  }
  return familia.charAt(0).toUpperCase() + familia.slice(1);
}
