/**
 * Valida busca por prefixo, codigo FIPE e modelo.
 * Uso: npx tsx scripts/validate-search.ts
 */
import fs from 'fs';
import path from 'path';
import { searchVehicles, normalizeText } from '../src/lib/search.ts';
import type { SearchIndexItem } from '../src/types.ts';

function loadShardIndex(): SearchIndexItem[] {
  const dir = path.join(process.cwd(), 'public', 'data', 'fipe', 'search');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8')) as {
    shards: string[];
  };
  const items: SearchIndexItem[] = [];
  for (const key of manifest.shards) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, `shard-${key}.json`), 'utf-8')) as Array<{
      i: string;
      n: string;
      m: string;
      a: number;
      v: number;
      t: string;
      c?: string;
      s: string;
      f?: string;
      cp?: string;
    }>;
    for (const row of shard) {
      items.push({
        id: row.i,
        nome: row.n,
        marca: row.m,
        ano: row.a,
        valor: row.v,
        tipo: row.t as SearchIndexItem['tipo'],
        combustivel: row.c,
        termoBusca: row.s,
        searchText: normalizeText(row.n),
        fipeCodigo: row.f,
        canonicalPath: row.cp,
      });
    }
  }
  return items;
}

type Case = {
  label: string;
  q: string;
  tipo?: 'carros' | 'motos' | 'caminhoes';
  minResults?: number;
  limit?: number;
  expectInTop?: string[];
  expectAnyInResults?: string[];
  expectFipe?: string;
  maxMs?: number;
};

const CASES: Case[] = [
  {
    label: 'Prefix S',
    q: 'S',
    minResults: 3,
    limit: 64,
    expectAnyInResults: ['sandero', 'siena', 'strada', 'spin', 'saveiro', 'sentra'],
    maxMs: 80,
  },
  { label: 'Prefix SI', q: 'SI', minResults: 1, expectInTop: ['Siena'], maxMs: 80 },
  { label: 'Prefix SIE', q: 'SIE', minResults: 1, expectInTop: ['Siena'], maxMs: 80 },
  { label: 'Prefix SIEN', q: 'SIEN', minResults: 1, expectInTop: ['Siena'], maxMs: 80 },
  { label: 'Prefix SIENA', q: 'SIENA', minResults: 1, expectInTop: ['Siena'], maxMs: 80 },
  { label: 'Modelo Corolla', q: 'Corolla', minResults: 5, expectInTop: ['Corolla'], maxMs: 50 },
  { label: 'FIPE 002112-1', q: '002112-1', minResults: 1, expectFipe: '002112-1', maxMs: 100 },
];

function matchesTop(results: SearchIndexItem[], needles: string[]): boolean {
  const top = results.slice(0, 8).map((r) => r.nome.toLowerCase()).join(' ');
  return needles.some((n) => top.includes(n.toLowerCase()));
}

function matchesAnyInResults(results: SearchIndexItem[], needles: string[]): boolean {
  const patterns = needles.map((n) => n.toLowerCase());
  return results.some((r) => {
    const nome = r.nome.toLowerCase();
    return patterns.some((p) => nome.includes(p));
  });
}

function main() {
  console.log('\n=== Validacao de Busca ===\n');
  const index = loadShardIndex();
  console.log(`Indice: ${index.length} veiculos\n`);

  let passed = 0;
  for (const c of CASES) {
    const limit = c.limit ?? 8;
    const t0 = performance.now();
    const results = searchVehicles(index, c.q, c.tipo ?? 'carros', limit);
    const ms = performance.now() - t0;

    const okCount = results.length >= (c.minResults ?? 1);
    const okTop = !c.expectInTop || matchesTop(results, c.expectInTop);
    const okAny = !c.expectAnyInResults || matchesAnyInResults(results, c.expectAnyInResults);
    const okFipe = !c.expectFipe || results.some((r) => r.fipeCodigo === c.expectFipe);
    const okPerf = ms <= (c.maxMs ?? 100);
    const ok = okCount && okTop && okAny && okFipe && okPerf;

    if (ok) passed++;
    console.log(
      `${ok ? 'OK' : 'FAIL'} ${c.label} ("${c.q}") -> ${results.length} em ${ms.toFixed(1)}ms | top: ${results[0]?.nome?.slice(0, 45) ?? '-'}`,
    );
    if (!ok && results[0]) {
      console.log(`     amostra: ${results.slice(0, 3).map((r) => r.nome).join(' | ')}`);
    }
  }

  console.log(`\n${passed}/${CASES.length} casos passaram\n`);
  process.exit(passed === CASES.length ? 0 : 1);
}

main();
