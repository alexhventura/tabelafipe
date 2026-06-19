/**
 * Teste automatizado da lógica de busca (sem browser).
 * Uso: npx tsx scripts/test-search.ts
 */
import fs from 'fs';
import path from 'path';
import { searchVehicles, normalizeText } from '../src/lib/search.ts';
import type { SearchIndexItem } from '../src/types.ts';

const indexPath = path.join(process.cwd(), 'public', 'api', 'busca-rapida.json');
const raw = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as SearchIndexItem[];

const index: SearchIndexItem[] = raw.map((item) => ({
  ...item,
  tipo: 'carros',
  ano: (item.nome.match(/\((\d{4})\)/) || [])[1]
    ? parseInt((item.nome.match(/\((\d{4})\)/) as RegExpMatchArray)[1], 10)
    : undefined,
  searchText: normalizeText(item.nome),
  popularidade: ['onix-2019', 'corolla-2021'].includes(item.id) ? 10 : 0,
}));

const CASES: { q: string; expectTop?: string; minResults?: number }[] = [
  { q: 'Corolla', minResults: 1, expectTop: 'Corolla' },
  { q: 'Corolla XEi', minResults: 1, expectTop: 'XEi' },
  { q: 'Onix LT', minResults: 1, expectTop: 'Onix LT' },
  { q: 'CG 160', minResults: 0 },
  { q: 'Renegade Diesel', minResults: 1, expectTop: 'Renegade' },
  { q: 'corola', minResults: 1, expectTop: 'Corolla' },
  { q: 'onx lt', minResults: 1, expectTop: 'Onix' },
];

console.log('\n=== Teste de Busca ===\n');
let passed = 0;
const ITER = 200;

for (const { q, expectTop, minResults = 0 } of CASES) {
  const t0 = performance.now();
  let results: SearchIndexItem[] = [];
  for (let i = 0; i < ITER; i++) results = searchVehicles(index, q, 'carros', 8);
  const ms = (performance.now() - t0) / ITER;

  const okCount = results.length >= minResults;
  const okTop = !expectTop || (results[0]?.nome.includes(expectTop) ?? false);
  const okPerf = ms < 100;
  const ok = okCount && okTop && okPerf;

  if (ok) passed++;
  console.log(`${ok ? '✅' : '❌'} "${q}" → ${results.length} | ${ms.toFixed(2)}ms | top: ${results[0]?.nome?.slice(0, 50) ?? '—'}`);
}

console.log(`\n${passed}/${CASES.length} testes passaram\n`);
