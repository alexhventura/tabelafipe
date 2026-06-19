import fs from 'fs';
import path from 'path';
import { PATHS } from './fipe-paths.js';
import { marcaSlug, modeloSlug, slugify } from './fipe-slug.js';

export interface VehiclePathInput {
  marca: string;
  modelo: string;
  ano: number;
  combustivel?: string;
  fipeCodigo?: string;
}

export function vehicleFileName(ano: number, suffix?: string): string {
  return suffix ? `${ano}-${suffix}.json` : `${ano}.json`;
}

export function vehicleRelDir(marca: string, modelo: string): string {
  return `${marcaSlug(marca)}/${modeloSlug(modelo)}`;
}

export function vehicleAbsPath(v: VehiclePathInput, suffix?: string): string {
  return path.join(
    PATHS.publicDataRoot,
    vehicleRelDir(v.marca, v.modelo),
    vehicleFileName(v.ano, suffix),
  );
}

export function vehiclePublicPath(v: VehiclePathInput, suffix?: string): string {
  const rel = path.posix.join(
    vehicleRelDir(v.marca, v.modelo).replace(/\\/g, '/'),
    vehicleFileName(v.ano, suffix),
  );
  return `/data/fipe/${rel}`;
}

export function resolveVehiclePaths(v: VehiclePathInput): {
  absPath: string;
  publicPath: string;
  suffix?: string;
} {
  let suffix: string | undefined;
  let absPath = vehicleAbsPath(v);

  if (fs.existsSync(absPath)) {
    suffix = slugify(v.combustivel || 'flex');
    absPath = vehicleAbsPath(v, suffix);
  }
  if (fs.existsSync(absPath) && v.fipeCodigo) {
    suffix = slugify(v.fipeCodigo);
    absPath = vehicleAbsPath(v, suffix);
  }

  return {
    absPath,
    publicPath: vehiclePublicPath(v, suffix),
    suffix,
  };
}

export function writeVehicleJson(
  v: VehiclePathInput,
  payload: Record<string, unknown>,
): { absPath: string; publicPath: string } {
  const resolved = resolveVehiclePaths(v);
  fs.mkdirSync(path.dirname(resolved.absPath), { recursive: true });
  fs.writeFileSync(
    resolved.absPath,
    JSON.stringify({ ...payload, dataPath: resolved.publicPath }),
  );
  return { absPath: resolved.absPath, publicPath: resolved.publicPath };
}
