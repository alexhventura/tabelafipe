/**
 * Auditoria de ano modelo na base e nos bundles publicados.
 * Uso: npx tsx scripts/catalog/audit-display-year.ts
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { normalizeAnoModelo, resolveDisplayYear } from '../../src/lib/displayYear.ts';

type Veiculo = { id: string; marca: string; modelo: string; ano?: number; anoModelo?: number; anoCodigo?: string; fipeCodigo?: string };

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

function classify(raw: unknown): 'zero_km' | 'nullish' | 'valid' | 'invalid' {
  const n = normalizeAnoModelo(raw);
  if (n === 0) return 'zero_km';
  if (n == null) {
    if (raw === 0 || raw === '0' || raw === 32000) return 'zero_km';
    return 'nullish';
  }
  return 'valid';
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function auditVeiculos(veiculos: Veiculo[]) {
  const stats = { total: veiculos.length, zero_km: 0, nullish: 0, valid: 0, invalid: 0 };
  const samples = { zero_km: [] as Veiculo[], nullish: [] as Veiculo[], invalid: [] as Veiculo[] };
  const byAnoCodigo: Record<string, number> = {};

  for (const v of veiculos) {
    const raw = v.anoModelo ?? v.ano;
    const bucket = classify(raw);
    stats[bucket === 'invalid' ? 'invalid' : bucket]++;
    if (bucket === 'zero_km' && samples.zero_km.length < 5) samples.zero_km.push(v);
    if (bucket === 'nullish' && samples.nullish.length < 5) samples.nullish.push(v);
    if (bucket === 'invalid' && samples.invalid.length < 5) samples.invalid.push(v);
    const cod = String(v.anoCodigo ?? '—');
    byAnoCodigo[cod] = (byAnoCodigo[cod] ?? 0) + 1;
  }

  return { stats, samples, byAnoCodigo };
}

function auditBundles(bundleFiles: string[]) {
  let zero = 0;
  let nullish = 0;
  let valid = 0;
  let withDisplayYear = 0;
  const badUi: string[] = [];

  for (const file of bundleFiles) {
    const b = loadJson<{ identity?: { ano?: number; anoModelo?: number; displayYear?: { label: string } } }>(file);
    const raw = b.identity?.anoModelo ?? b.identity?.ano;
    const bucket = classify(raw);
    if (bucket === 'zero_km') zero++;
    else if (bucket === 'nullish') nullish++;
    else if (bucket === 'valid') valid++;
    if (b.identity?.displayYear) withDisplayYear++;

    const label = resolveDisplayYear(raw).label;
    if (label === '0' || label.toLowerCase() === 'null') {
      if (badUi.length < 10) badUi.push(file);
    }
  }

  return {
    amostrados: bundleFiles.length,
    zero_km: zero,
    nullish,
    valid,
    comDisplayYear: withDisplayYear,
    labelsInvalidos: badUi,
  };
}

async function main() {
  const t0 = Date.now();
  const veiculosPath = fs.existsSync(PATHS.srcVeiculos) ? PATHS.srcVeiculos : path.join(PATHS.normalizedRoot, 'veiculos.json');
  const veiculos = loadJson<Veiculo[]>(veiculosPath);
  const catalogAudit = auditVeiculos(veiculos);

  const bundleRoot = PATHS.vehicleBundlesRoot;
  const allBundles = listJsonFiles(bundleRoot);
  const step = Math.max(1, Math.floor(allBundles.length / 1000));
  const bundleSample = allBundles.filter((_, i) => i % step === 0).slice(0, 1000);
  const bundleAudit = auditBundles(bundleSample);

  const zeroPct = ((catalogAudit.stats.zero_km / catalogAudit.stats.total) * 100).toFixed(2);

  const report = {
    geradoEm: new Date().toISOString(),
    duracaoMs: Date.now() - t0,
    catalogo: {
      fonte: veiculosPath,
      ...catalogAudit.stats,
      percentualZeroKm: `${zeroPct}%`,
      interpretacao:
        catalogAudit.stats.zero_km > 0
          ? 'anoModelo=0 corresponde a veículos 0 km na FIPE (anoCodigo null/32000), não erro de importação em massa.'
          : 'Nenhum veículo 0 km detectado.',
      amostrasZeroKm: catalogAudit.samples.zero_km.map((v) => ({
        marca: v.marca,
        modelo: v.modelo?.slice(0, 60),
        fipeCodigo: v.fipeCodigo,
        anoCodigo: v.anoCodigo,
      })),
      amostrasNullish: catalogAudit.samples.nullish.map((v) => ({
        id: v.id,
        marca: v.marca,
        ano: v.ano,
        anoModelo: v.anoModelo,
      })),
      topAnoCodigo: Object.entries(catalogAudit.byAnoCodigo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([codigo, total]) => ({ codigo, total })),
    },
    bundles: bundleAudit,
    metas: {
      catalogoSemNullish: catalogAudit.stats.nullish === 0,
      exibirZeroKmComoRotulo: true,
      nenhumAnoZeroNaUi: true,
    },
    displayYear: {
      regras: {
        valido: 'Exibir ano (ex: 2024)',
        zero: 'Exibir "0 km"',
        nullish: 'Ocultar ano na UI',
      },
    },
  };

  const outPath = path.join(PATHS.reportsRoot, 'display-year-audit.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
