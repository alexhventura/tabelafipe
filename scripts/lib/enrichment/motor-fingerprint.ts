/**
 * Impressao digital de motorizacao para propagacao segura entre versoes FIPE.
 */
import { inferSpecsFromFipeModel } from './infer-fipe-specs.js';
import { normalizeVersao } from './matching-engine.js';

export interface MotorFingerprint {
  cilindradaCc: number | null;
  potenciaCv: number | null;
  cambio: string | null;
  turbo: boolean;
  key: string;
}

export function normCambio(c: string | null | undefined): string | null {
  if (!c) return null;
  const u = c.toLowerCase();
  if (u.includes('manual') || u === 'mt') return 'manual';
  if (u.includes('cvt')) return 'cvt';
  if (u.includes('automatiz') || u.includes('dct') || u.includes('dsg')) return 'automatizado';
  if (u.includes('automat')) return 'automatico';
  return u;
}

export function buildMotorFingerprint(
  modelo: string,
  overrides?: { cilindradaCc?: number; potenciaCv?: number; cambio?: string },
): MotorFingerprint {
  const inf = inferSpecsFromFipeModel(modelo);
  const cilindradaCc = overrides?.cilindradaCc ?? inf.cilindradaCc;
  const potenciaCv = overrides?.potenciaCv ?? inf.potenciaCv;
  const cambio = normCambio(overrides?.cambio ?? inf.cambio);
  const turbo = inf.turbo || /\bTURBO\b/i.test(modelo);
  const parts = [
    cilindradaCc ? `cc${cilindradaCc}` : '',
    potenciaCv ? `cv${potenciaCv}` : '',
    cambio ?? '',
    turbo ? 't' : '',
  ].filter(Boolean);
  return { cilindradaCc, potenciaCv, cambio, turbo, key: parts.join('|') || normalizeVersao(modelo).slice(0, 40) };
}

export function sameMotorization(a: MotorFingerprint, b: MotorFingerprint): boolean {
  if (!a.key || !b.key) return false;
  if (a.key === b.key) return true;
  if (a.cilindradaCc && b.cilindradaCc && a.cilindradaCc !== b.cilindradaCc) return false;
  if (a.potenciaCv && b.potenciaCv && Math.abs(a.potenciaCv - b.potenciaCv) > 5) return false;
  if (a.cambio && b.cambio && a.cambio !== b.cambio) return false;
  if (a.turbo !== b.turbo) return false;
  return a.cilindradaCc === b.cilindradaCc && a.potenciaCv === b.potenciaCv && a.cambio === b.cambio;
}