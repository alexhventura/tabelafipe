/**
 * Relatório de otimização da busca: cobertura, latência e resultados por letra.
 * Uso: npx tsx scripts/search-optimization-report.ts
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from './lib/fipe-paths.js';
import {
  searchSuggestions,
  searchFamilies,
  AUTOCOMPLETE_LIMIT,
  normalizeText,
} from '../src/lib/search.ts';
import type { FamilySearchItem, SearchIndexItem, VehicleTipo } from '../src/types.ts';

type CompactFamily = {
  id: string;
  fa: string;
  fd: string;
  m: string;
  md: string;
  t: VehicleTipo;
  n: number;
  vmin: number;
  vmax: number;
  amin: number;
  amax: number;
  cp?: string;
};

function loadFamilies(): FamilySearchItem[] {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PATHS.publicSearchDir, 'families-manifest.json'), 'utf-8'),
  ) as { shards: string[]; total: number };
  const byId = new Map<string, FamilySearchItem>();
  for (const shard of manifest.shards) {
    const rows = JSON.parse(
      fs.readFileSync(path.join(PATHS.publicSearchDir, `family-shard-${shard}.json`), 'utf-8'),
    ) as CompactFamily[];
    for (const row of rows) {
      if (byId.has(row.id)) continue;
      byId.set(row.id, {
        id: row.id,
        familia: row.fa,
        familiaDisplay: row.fd,
        marca: row.md,
        marcaSlug: row.m,
        tipo: row.t,
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

function loadVehicles(): SearchIndexItem[] {
  const manifest = JSON.parse(fs.readFileSync(PATHS.publicSearchManifest, 'utf-8')) as {
    shards: string[];
  };
  const byId = new Map<string, SearchIndexItem>();
  for (const shard of manifest.shards) {
    const rows = JSON.parse(
      fs.readFileSync(path.join(PATHS.publicSearchDir, `shard-${shard}.json`), 'utf-8'),
    ) as Array<{
      i: string;
      n: string;
      m: string;
      a: number;
      v: number;
      t: VehicleTipo;
      c?: string;
      s: string;
      mo?: string;
      f?: string;
      cp?: string;
    }>;
    for (const row of rows) {
      if (byId.has(row.i)) continue;
      byId.set(row.i, {
        id: row.i,
        nome: row.n,
        marca: row.m,
        ano: row.a,
        valor: row.v,
        tipo: row.t,
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

function loadShardFamilies(letter: string): FamilySearchItem[] {
  const file = path.join(PATHS.publicSearchDir, `family-shard-${letter}.json`);
  if (!fs.existsSync(file)) return [];
  const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as CompactFamily[];
  return rows.map((row) => ({
    id: row.id,
    familia: row.fa,
    familiaDisplay: row.fd,
    marca: row.md,
    marcaSlug: row.m,
    tipo: row.t,
    versaoCount: row.n,
    valorMin: row.vmin,
    valorMax: row.vmax,
    anoMin: row.amin,
    anoMax: row.amax,
    hubPath: row.cp,
  }));
}

function loadShardVehicles(letter: string): SearchIndexItem[] {
  const file = path.join(PATHS.publicSearchDir, `shard-${letter}.json`);
  if (!fs.existsSync(file)) return [];
  const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as Array<{
    i: string;
    n: string;
    m: string;
    a: number;
    v: number;
    t: VehicleTipo;
    c?: string;
    s: string;
    mo?: string;
    f?: string;
    cp?: string;
  }>;
  return rows.map((row) => ({
    id: row.i,
    nome: row.n,
    marca: row.m,
    ano: row.a,
    valor: row.v,
    tipo: row.t,
    combustivel: row.c,
    termoBusca: row.s,
    modelo: row.mo,
    searchText: normalizeText(row.mo ? `${row.m} ${row.mo}` : row.n),
    fipeCodigo: row.f,
    canonicalPath: row.cp,
  }));
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const SPOT_CHECKS: Record<string, string[]> = {
  s: ['sandero', 'saveiro', 'sentra', 'siena', 'spin', 'strada'],
  c: ['celta', 'cerato', 'civic', 'city', 'compass', 'corolla', 'creta', 'cruze'],
};

function main() {
  const t0 = Date.now();
  const families = loadFamilies();
  const vehicles = loadVehicles();
  const latencies: number[] = [];
  const porLetra: Record<string, { familias: number; ms: number; amostra: string[] }> = {};

  for (const letter of LETTERS) {
    const famShard = loadShardFamilies(letter);
    const vehShard = loadShardVehicles(letter);
    const start = performance.now();
    const hits = searchSuggestions(famShard, vehShard, letter, 'carros', AUTOCOMPLETE_LIMIT);
    const ms = performance.now() - start;
    latencies.push(ms);
    porLetra[letter] = {
      familias: hits.filter((h) => h.kind === 'familia').length,
      ms: Math.round(ms * 100) / 100,
      amostra: hits.slice(0, 5).map((h) =>
        h.kind === 'familia' ? `${h.item.marca} ${h.item.familiaDisplay}` : h.item.nome.slice(0, 40),
      ),
    };
  }

  const fipeStart = performance.now();
  const fipeHits = searchSuggestions(families, vehicles, '002112-1', 'carros', AUTOCOMPLETE_LIMIT);
  const fipeMs = performance.now() - fipeStart;
  latencies.push(fipeMs);

  const cobertura: Record<string, { esperados: number; encontrados: number; faltando: string[] }> = {};
  for (const [letter, needles] of Object.entries(SPOT_CHECKS)) {
    const famShard = loadShardFamilies(letter);
    const hits = searchFamilies(famShard, letter, 'carros', 100);
    const names = hits.map((h) => h.familia.toLowerCase()).join(' ');
    const faltando = needles.filter((n) => !names.includes(n));
    cobertura[letter.toUpperCase()] = {
      esperados: needles.length,
      encontrados: needles.length - faltando.length,
      faltando,
    };
  }

  const report = {
    geradoEm: new Date().toISOString(),
    duracaoMs: Date.now() - t0,
    indice: {
      veiculosTotal: vehicles.length,
      familiasTotal: families.length,
      limiteAutocomplete: AUTOCOMPLETE_LIMIT,
    },
    latencia: {
      mediaMs: Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100,
      fipeMs: Math.round(fipeMs * 100) / 100,
    },
    porLetra,
    cobertura,
    fipe: {
      query: '002112-1',
      resultados: fipeHits.length,
      top: fipeHits[0]?.kind === 'veiculo' ? fipeHits[0].item.nome : null,
    },
    metas: {
      autocomplete10: AUTOCOMPLETE_LIMIT === 10,
      coberturaSCompleta: (cobertura.S?.faltando.length ?? 1) === 0,
      coberturaCCompleta: (cobertura.C?.faltando.length ?? 1) === 0,
    },
  };

  const out = path.join(PATHS.reportsRoot, 'search-optimization-report.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
}

main();
