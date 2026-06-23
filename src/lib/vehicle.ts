import { ConsumoData, HistoricoPreco, Vehicle } from '../types';
import { normalizeAnoModelo } from './displayYear';

const DEFAULT_CONSUMO: ConsumoData = {
  cidadeG: 10,
  cidadeE: 7,
  estradaG: 12,
  estradaE: 8,
};

interface RawVehicle {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  anoModelo?: number;
  ano?: number;
  fipeCodigo?: string;
  codigoFipe?: string;
  combustivel: string;
  valorAtual?: number;
  valor?: number;
  categoriaPecas?: Vehicle['categoriaPecas'];
  consumo?: Partial<ConsumoData>;
  historicoPrecos?: HistoricoPreco[];
}

export function normalizeVehicle(raw: RawVehicle): Vehicle {
  const historico = raw.historicoPrecos ?? [];
  const valorAtual =
    raw.valorAtual ?? raw.valor ?? historico[historico.length - 1]?.valor ?? 0;

  return {
    id: raw.id,
    nome: raw.nome,
    marca: raw.marca,
    modelo: raw.modelo,
    anoModelo: normalizeAnoModelo(raw.anoModelo ?? raw.ano) ?? 0,
    fipeCodigo: raw.fipeCodigo ?? raw.codigoFipe ?? '',
    combustivel: raw.combustivel,
    valorAtual,
    categoriaPecas: raw.categoriaPecas ?? 'media',
    consumo: { ...DEFAULT_CONSUMO, ...raw.consumo },
    historicoPrecos: historico,
  };
}

export function computeTrend(historico: HistoricoPreco[], months: number): number | null {
  if (historico.length < 2) return null;
  const end = historico[historico.length - 1].valor;
  const startIdx = Math.max(0, historico.length - 1 - months);
  const start = historico[startIdx].valor;
  if (start === 0) return null;
  return ((end - start) / start) * 100;
}

async function resolveDataPath(id: string): Promise<string | undefined> {
  const key = id[0]?.toLowerCase();
  if (!key || !/[a-z]/.test(key)) return undefined;

  try {
    const manifestRes = await fetch('/data/fipe/search/manifest.json');
    if (!manifestRes.ok) return undefined;
    const manifest = (await manifestRes.json()) as { shards?: string[] };
    if (!manifest.shards?.includes(key)) return undefined;

    const shardRes = await fetch(`/data/fipe/search/shard-${key}.json`);
    if (!shardRes.ok) return undefined;
    const items = (await shardRes.json()) as { i: string; p?: string }[];
    return items.find((item) => item.i === id)?.p;
  } catch {
    return undefined;
  }
}

export async function loadVehicle(id: string, dataPath?: string): Promise<Vehicle | null> {
  const resolvedPath = dataPath ?? (await resolveDataPath(id));
  const paths = [
    resolvedPath,
    `/data/fipe/veiculos/${id}.json`,
    `/api/fipe/veiculos/${id}.json`,
    `/api/historico/${id}.json`,
  ].filter(Boolean) as string[];

  for (const url of paths) {
    try {
      const res = await fetch(url);
      if (res.ok) return normalizeVehicle((await res.json()) as RawVehicle);
    } catch {
      /* tenta proxima fonte */
    }
  }
  return null;
}

export function vehicleDisplayName(vehicle: Vehicle): string {
  return vehicle.nome.replace(/\s*\(\d{4}\)\s*$/, '').trim();
}
