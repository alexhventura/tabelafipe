/**
 * Valida busca por prefixo, familias, codigo FIPE e modelo.
 * Uso: npx tsx scripts/validate-search.ts
 */
import fs from 'fs';
import path from 'path';
import { searchSuggestions, searchVehicles, AUTOCOMPLETE_LIMIT, normalizeText } from '../src/lib/search.ts';
import type { FamilySearchItem, SearchIndexItem } from '../src/types.ts';

function loadFamilies(): FamilySearchItem[] {
  const dir = path.join(process.cwd(), 'public', 'data', 'fipe', 'search');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'families-manifest.json'), 'utf-8')) as {
    shards: string[];
  };
  const byId = new Map<string, FamilySearchItem>();
  for (const key of manifest.shards) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, `family-shard-${key}.json`), 'utf-8')) as Array<{
      id: string; fa: string; fd: string; m: string; md: string; t: string; n: number;
      vmin: number; vmax: number; amin: number; amax: number; cp?: string;
    }>;
    for (const row of shard) {
      if (byId.has(row.id)) continue;
      byId.set(row.id, {
        id: row.id,
        familia: row.fa,
        familiaDisplay: row.fd,
        marca: row.md,
        marcaSlug: row.m,
        tipo: row.t as FamilySearchItem['tipo'],
        versaoCount: row.n,
        valorMin: row.vmin,
        valorMax: row.vmax,
        anoMin: row.amin,
        anoMax: row.amax,
        hubPath: row.cp,
      });
    }
  }
  return [...byId.values()];
}

function loadShardIndex(): SearchIndexItem[] {
  const dir = path.join(process.cwd(), 'public', 'data', 'fipe', 'search');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8')) as {
    shards: string[];
  };
  const byId = new Map<string, SearchIndexItem>();
  for (const key of manifest.shards) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, `shard-${key}.json`), 'utf-8')) as Array<{
      i: string; n: string; m: string; a: number; v: number; t: string; c?: string; s: string; mo?: string; f?: string; cp?: string;
    }>;
    for (const row of shard) {
      if (byId.has(row.i)) continue;
      byId.set(row.i, {
        id: row.i,
        nome: row.n,
        marca: row.m,
        ano: row.a,
        valor: row.v,
        tipo: row.t as SearchIndexItem['tipo'],
        combustivel: row.c,
        termoBusca: row.s,
        modelo: row.mo,
        searchText: normalizeText(row.mo ? `${row.m} ${row.mo}` : row.n),
        fipeCodigo: row.f,
        canonicalPath: row.cp,
      });
    }
  }
  return [...byId.values()];
}

const familyShardCache = new Map<string, FamilySearchItem[]>();
const vehicleShardCache = new Map<string, SearchIndexItem[]>();

function loadFamilyShard(key: string): FamilySearchItem[] {
  if (familyShardCache.has(key)) return familyShardCache.get(key)!;
  const file = path.join(process.cwd(), 'public', 'data', 'fipe', 'search', `family-shard-${key}.json`);
  if (!fs.existsSync(file)) return [];
  const shard = JSON.parse(fs.readFileSync(file, 'utf-8')) as Array<{
    id: string; fa: string; fd: string; m: string; md: string; t: string; n: number;
    vmin: number; vmax: number; amin: number; amax: number; cp?: string;
  }>;
  const items = shard.map((row) => ({
    id: row.id,
    familia: row.fa,
    familiaDisplay: row.fd,
    marca: row.md,
    marcaSlug: row.m,
    tipo: row.t as FamilySearchItem['tipo'],
    versaoCount: row.n,
    valorMin: row.vmin,
    valorMax: row.vmax,
    anoMin: row.amin,
    anoMax: row.amax,
    hubPath: row.cp,
  }));
  familyShardCache.set(key, items);
  return items;
}

function loadVehicleShard(key: string): SearchIndexItem[] {
  if (vehicleShardCache.has(key)) return vehicleShardCache.get(key)!;
  const file = path.join(process.cwd(), 'public', 'data', 'fipe', 'search', `shard-${key}.json`);
  if (!fs.existsSync(file)) return [];
  const shard = JSON.parse(fs.readFileSync(file, 'utf-8')) as Array<{
    i: string; n: string; m: string; a: number; v: number; t: string; c?: string; s: string; mo?: string; f?: string; cp?: string;
  }>;
  const items = shard.map((row) => ({
    id: row.i,
    nome: row.n,
    marca: row.m,
    ano: row.a,
    valor: row.v,
    tipo: row.t as SearchIndexItem['tipo'],
    combustivel: row.c,
    termoBusca: row.s,
    modelo: row.mo,
    searchText: normalizeText(row.mo ? `${row.m} ${row.mo}` : row.n),
    fipeCodigo: row.f,
    canonicalPath: row.cp,
  }));
  vehicleShardCache.set(key, items);
  return items;
}

type Case = {
  label: string;
  q: string;
  tipo?: 'carros' | 'motos' | 'caminhoes';
  minResults?: number;
  expectFamilies?: string[];
  expectInTop?: string[];
  expectFipe?: string;
  maxMs?: number;
  useShard?: boolean;
};

const CASES: Case[] = [
  {
    label: 'Prefix S',
    q: 'S',
    minResults: 3,
    expectFamilies: ['sandero', 'siena', 'strada', 'spin', 'saveiro', 'sentra'],
    maxMs: 350,
    useShard: true,
  },
  {
    label: 'Prefix C',
    q: 'C',
    minResults: 3,
    expectFamilies: ['celta', 'cerato', 'civic', 'city', 'compass', 'corolla', 'creta', 'cruze'],
    maxMs: 350,
    useShard: true,
  },
  { label: 'Prefix SI', q: 'SI', minResults: 1, expectInTop: ['Siena'], maxMs: 250, useShard: true },
  { label: 'Familia Corolla', q: 'Corolla', minResults: 1, expectInTop: ['Corolla'], maxMs: 250, useShard: true },
  { label: 'FIPE 002112-1', q: '002112-1', minResults: 1, expectFipe: '002112-1', maxMs: 150 },
];

function labelOf(s: ReturnType<typeof searchSuggestions>[number]): string {
  if (s.kind === 'familia') return `${s.item.marca} ${s.item.familiaDisplay}`;
  return s.item.nome;
}

function matchesFamilies(results: ReturnType<typeof searchSuggestions>, needles: string[]): boolean {
  const text = results
    .filter((r) => r.kind === 'familia')
    .map((r) => r.item.familia.toLowerCase())
    .join(' ');
  return needles.some((n) => text.includes(n.toLowerCase()));
}

function matchesTop(results: ReturnType<typeof searchSuggestions>, needles: string[]): boolean {
  const top = results.slice(0, AUTOCOMPLETE_LIMIT).map(labelOf).join(' ').toLowerCase();
  return needles.some((n) => top.includes(n.toLowerCase()));
}

function main() {
  console.log('\n=== Validacao de Busca ===\n');
  const fullFamilies = loadFamilies();
  const fullVehicles = loadShardIndex();
  console.log(`Veiculos: ${fullVehicles.length} | Familias: ${fullFamilies.length}\n`);

  let passed = 0;
  for (const c of CASES) {
    const letter = normalizeText(c.q)[0];
    const families =
      c.useShard && letter && /[a-z]/.test(letter) ? loadFamilyShard(letter) : fullFamilies;
    const vehicles =
      c.useShard && letter && /[a-z]/.test(letter) ? loadVehicleShard(letter) : fullVehicles;

    const t0 = performance.now();
    const results = searchSuggestions(families, vehicles, c.q, c.tipo ?? 'carros', AUTOCOMPLETE_LIMIT);
    const ms = performance.now() - t0;

    const okCount = results.length >= (c.minResults ?? 1);
    const okFamilies = !c.expectFamilies || matchesFamilies(results, c.expectFamilies);
    const okTop = !c.expectInTop || matchesTop(results, c.expectInTop);
    const okFipe =
      !c.expectFipe ||
      results.some((r) => r.kind === 'veiculo' && r.item.fipeCodigo === c.expectFipe);
    const okLimit = results.length <= AUTOCOMPLETE_LIMIT;
    const okPerf = ms <= (c.maxMs ?? 200);
    const ok = okCount && okFamilies && okTop && okFipe && okLimit && okPerf;

    if (ok) passed++;
    console.log(
      `${ok ? 'OK' : 'FAIL'} ${c.label} ("${c.q}") -> ${results.length} em ${ms.toFixed(1)}ms | top: ${labelOf(results[0])?.slice(0, 45) ?? '-'}`,
    );
    if (!ok) {
      console.log(`     amostra: ${results.slice(0, 3).map(labelOf).join(' | ')}`);
    }
  }

  console.log(`\n${passed}/${CASES.length} casos passaram | limite autocomplete: ${AUTOCOMPLETE_LIMIT}\n`);
  process.exit(passed === CASES.length ? 0 : 1);
}

main();
