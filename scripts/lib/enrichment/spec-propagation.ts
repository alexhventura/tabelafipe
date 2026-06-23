import type { ModelFamily } from './generation-match.js';
import { resolveGeneration, sameGeneration } from './generation-match.js';
import { buildMotorFingerprint, normCambio, sameMotorization, type MotorFingerprint } from './motor-fingerprint.js';
import type { NormalizedVehicle } from './types.js';

export interface PropagatableSpec {
  potencia?: number;
  torque?: number;
  transmissao?: string;
  porta_malas?: number;
  tanque?: number;
  peso?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  entre_eixos?: number;
  aceleracao0a100?: number;
  velocidade_max?: number;
  bateria_kwh?: number;
  autonomia_km?: number;
  geracao_id?: string;
}

export interface PropagationSeed {
  vehicleId: string;
  vehicle: NormalizedVehicle;
  spec: PropagatableSpec;
  confidence: number;
  fonte: string;
  metodo: string;
  motor: MotorFingerprint;
}

const MATCH_PROPAGATE = 0.55;
const YEAR_PENALTY = 0.08;

export function canPropagateSpec(seed: PropagationSeed, peer: NormalizedVehicle, genCatalog: Map<string, ModelFamily>): boolean {
  if (!sameGeneration(peer.marca, peer.modeloSlug, peer.ano, seed.vehicle.ano, genCatalog)) return false;
  const peerMotor = buildMotorFingerprint(peer.modelo, {
    potenciaCv: seed.spec.potencia,
    cambio: seed.spec.transmissao,
  });
  if (!sameMotorization(seed.motor, peerMotor)) return false;
  if (seed.spec.transmissao && peerMotor.cambio) {
    const a = normCambio(seed.spec.transmissao);
    const b = normCambio(peerMotor.cambio);
    if (a && b && a !== b) return false;
  }
  const peerGen = resolveGeneration(peer.marca, peer.modeloSlug, peer.ano, genCatalog);
  const seedGen = resolveGeneration(seed.vehicle.marca, seed.vehicle.modeloSlug, seed.vehicle.ano, genCatalog);
  if (seedGen && peerGen && seedGen.id !== peerGen.id) return false;
  return true;
}

export function propagationConfidence(seedConfidence: number, seedAno: number, peerAno: number): number {
  return Math.max(0.45, seedConfidence - Math.abs(peerAno - seedAno) * YEAR_PENALTY);
}

export function shouldApplyPropagation(conf: number, existingConfidence?: number): boolean {
  if (conf < MATCH_PROPAGATE) return false;
  if (existingConfidence != null && existingConfidence >= 0.65) return false;
  return true;
}

export function buildSeed(
  vehicle: NormalizedVehicle,
  spec: PropagatableSpec,
  confidence: number,
  fonte: string,
  metodo: string,
): PropagationSeed {
  return {
    vehicleId: vehicle.vehicleId,
    vehicle,
    spec,
    confidence,
    fonte,
    metodo,
    motor: buildMotorFingerprint(vehicle.modelo, { potenciaCv: spec.potencia, cambio: spec.transmissao }),
  };
}