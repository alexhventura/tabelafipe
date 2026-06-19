import { SearchIndexItem } from '../types';
import { MODELO_SEGMENTO, SEGMENTO_RIVAIS } from '../data/segmentos';
import { marcaSlug, vehiclePath } from './slug';

export interface AlternativeItem {
  id: string;
  nome: string;
  valor: number;
  ano: number;
  href: string;
}

function extractModeloBase(termoBusca: string, nome: string): string | null {
  const text = `${termoBusca} ${nome}`.toLowerCase();
  for (const modelo of Object.keys(MODELO_SEGMENTO)) {
    if (text.includes(modelo)) return modelo;
  }
  return null;
}

export function findAlternatives(
  current: SearchIndexItem,
  index: SearchIndexItem[],
  limit = 3,
): AlternativeItem[] {
  const modeloBase = extractModeloBase(current.termoBusca, current.nome);
  if (!modeloBase) return [];

  const segmento = MODELO_SEGMENTO[modeloBase];
  const rivais = SEGMENTO_RIVAIS[segmento]?.filter((r) => r !== modeloBase) ?? [];

  const candidates = index.filter((item) => {
    if (item.id === current.id) return false;
    const anoDiff = Math.abs((item.ano ?? 0) - (current.ano ?? 0));
    if (anoDiff > 1) return false;
    const text = item.termoBusca.toLowerCase();
    return rivais.some((r) => text.includes(r));
  });

  return candidates
    .sort((a, b) => {
      const diffA = Math.abs(a.valor - current.valor);
      const diffB = Math.abs(b.valor - current.valor);
      return diffA - diffB;
    })
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      nome: item.nome.replace(/\s*\(\d{4}\)\s*$/, '').trim(),
      valor: item.valor,
      ano: item.ano ?? 0,
      href: vehiclePath(item.marca ?? 'geral', item.id),
    }));
}
