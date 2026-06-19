import { HistoricoPreco, Vehicle } from '../types';

export function computeTrend(historico: HistoricoPreco[], months: number): number | null {
  if (historico.length < 2) return null;
  const end = historico[historico.length - 1].valor;
  const startIdx = Math.max(0, historico.length - 1 - months);
  const start = historico[startIdx].valor;
  if (start === 0) return null;
  return ((end - start) / start) * 100;
}

export async function loadVehicle(id: string, dataPath?: string): Promise<Vehicle | null> {
  const paths = [
    dataPath,
    `/data/fipe/veiculos/${id}.json`,
    `/api/fipe/veiculos/${id}.json`,
    `/api/historico/${id}.json`,
  ].filter(Boolean) as string[];

  for (const url of paths) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as Vehicle;
    } catch {
      /* tenta proxima fonte */
    }
  }
  return null;
}

export function vehicleDisplayName(vehicle: Vehicle): string {
  return vehicle.nome.replace(/\s*\(\d{4}\)\s*$/, '').trim();
}
