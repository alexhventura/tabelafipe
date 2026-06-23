import fs from 'fs';
import { PATHS } from '../lib/fipe-paths.js';
import { buildMatchIndex, findMatchCollisions, normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import { classifyCollisionReason, computeMatchingScore } from '../lib/enrichment/matching-score.js';
import type { NormalizedVehicle } from '../lib/enrichment/types.js';

async function main() {
  const file = fs.existsSync(PATHS.normalizedVeiculos) ? PATHS.normalizedVeiculos : PATHS.srcVeiculos;
  const vehicles: NormalizedVehicle[] = JSON.parse(fs.readFileSync(file, 'utf-8')).map((v: NormalizedVehicle) => v.vehicleId ? v : normalizeVehicle(v));
  const byId = new Map(vehicles.map(v => [v.vehicleId, { marca: v.marca, modelo: v.modelo, ano: v.ano }]));
  const collisions = findMatchCollisions(buildMatchIndex(vehicles));

  const porTipo: Record<string, number> = {};
  const amostras: { key: string; tipo: string; ids: string[]; scoreMedio: number }[] = [];

  for (const c of collisions) {
    const tipo = classifyCollisionReason(c.key, c.ids, byId);
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
    if (amostras.length < 50) {
      const ref = byId.get(c.ids[0])!;
      const scores = c.ids.slice(1).map(id => computeMatchingScore({ ...ref, ano: ref.ano }, { ...byId.get(id)!, ano: byId.get(id)!.ano }));
      amostras.push({ key: c.key, tipo, ids: c.ids, scoreMedio: scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 1 });
    }
  }

  const report = {
    geradoEm: new Date().toISOString(),
    totalColisoes: collisions.length,
    classificacao: porTipo,
    interpretacao: {
      versao_duplicada_multi_ano: 'Mesma chave familia sem ano — varios anos no FIPE (esperado)',
      versao_diferente_mesmo_ano: 'Versoes distintas no mesmo ano-modelo',
      acentuacao: 'Diferenca apenas de acentos/grafia',
      abreviacao: 'MEC/AUT/CVT ou abreviacoes no nome',
      nome_comercial_vs_tecnico: 'Nomes comerciais vs tecnicos',
      ano_divergente: 'Anos diferentes na mesma chave',
    },
    matchingScore: { descricao: '0-1 similaridade marca+modelo+ano', amostras },
    recomendacoes: [
      'Usar manufacturerMatchKey com versao completa para specs',
      'Propagacao apenas dentro da mesma geracao (generations-catalog)',
      'Score >= 0.72 para match fabricante direto',
      'Score 0.55-0.72 com propagacao por geracao',
    ],
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.matchingAnalysisReport, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ totalColisoes: collisions.length, classificacao: porTipo }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });