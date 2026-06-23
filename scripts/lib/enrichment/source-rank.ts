export const SOURCE_RANK = {
  fabricante_oficial: 1,
  catalogo_pdf_oficial: 2,
  manual_oficial: 3,
  inmetro: 4,
  ncap: 5,
  inferencia: 6,
  heuristica: 7,
} as const;

export type SourceRankKey = keyof typeof SOURCE_RANK;

export function rankFromMetodo(metodo: string, fonte?: string): number {
  const m = (metodo || "").toLowerCase();
  const f = (fonte || "").toLowerCase();
  if (m.includes("fabricante") || f.includes("fabricante") || f.includes("oem")) return SOURCE_RANK.fabricante_oficial;
  if (m.includes("pdf") || f.includes(".pdf") || m.includes("catalogo_pdf")) return SOURCE_RANK.catalogo_pdf_oficial;
  if (m.includes("manual")) return SOURCE_RANK.manual_oficial;
  if (m.includes("inmetro") || f.includes("inmetro")) return SOURCE_RANK.inmetro;
  if (m.includes("ncap") || f.includes("ncap")) return SOURCE_RANK.ncap;
  if (m.includes("propag") || m.includes("infer") || m === "fipe_inferido") return SOURCE_RANK.inferencia;
  return SOURCE_RANK.heuristica;
}

export function confidenceFromRank(rank: number, baseConfidence: number): number {
  const penalty = Math.max(0, rank - 1) * 0.04;
  return Math.max(0.35, Math.min(0.98, baseConfidence - penalty));
}
