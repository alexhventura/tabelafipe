/**
 * Auditoria de qualidade de dados exibidos ao usuário.
 * Varre bundles e detecta (null), elétricos com gasolina, anos inválidos, etc.
 *
 * Uso: npx tsx scripts/datasets/audit-data-quality.ts [--limit N]
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { hasElectricLiquidFuelBug } from '../../src/lib/consumoDisplay.ts';
import { normalizeFuelType } from '../../src/lib/fuelType.ts';

const JUNK_PATTERN = /(\(null\)|\(undefined\)|\(nan\)|\(0\)|\bnull\b|\bundefined\b|\bNaN\b)/i;
const LIQUID_FUEL_ON_ELECTRIC = /gasolina|etanol|diesel/i;

interface QualityIssue {
  vehicleId: string;
  bundlePath: string;
  marca: string;
  displayName: string;
  combustivel: string;
  issue: string;
  field: string;
  sample: string;
}

function walkBundles(root: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(root)) return files;
  for (const marca of fs.readdirSync(root)) {
    const marcaDir = path.join(root, marca);
    if (!fs.statSync(marcaDir).isDirectory()) continue;
    for (const f of fs.readdirSync(marcaDir)) {
      if (f.endsWith('.json')) files.push(path.join(marcaDir, f));
    }
  }
  return files;
}

function scanText(
  text: string,
  ctx: { vehicleId: string; bundlePath: string; marca: string; displayName: string; combustivel: string },
  field: string,
  issue: string,
  issues: QualityIssue[],
) {
  if (JUNK_PATTERN.test(text)) {
    issues.push({ ...ctx, issue, field, sample: text.slice(0, 120) });
  }
}

async function main() {
  const started = Date.now();
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) || 0 : 0;

  let files = walkBundles(PATHS.vehicleBundlesRoot);
  if (limit > 0) files = files.slice(0, limit);

  const issues: QualityIssue[] = [];
  const counters = {
    nullVisible: 0,
    undefinedVisible: 0,
    electricWithLiquidFuel: 0,
    hybridInconsistent: 0,
    invalidYear: 0,
    anoZeroInTitle: 0,
  };

  for (const file of files) {
    const bundle = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    const identity = bundle.identity as Record<string, unknown>;
    const ctx = {
      vehicleId: String(identity?.vehicleId ?? ''),
      bundlePath: String(bundle.bundlePath ?? file),
      marca: String(identity?.marca ?? ''),
      displayName: String(identity?.displayName ?? ''),
      combustivel: String(identity?.combustivel ?? ''),
    };

    const fieldsToScan = [
      ['identity.displayName', ctx.displayName],
      ['seo.title', (bundle.seo as { title?: string })?.title ?? ''],
      ['seo.h1', (bundle.seo as { h1?: string })?.h1 ?? ''],
      ['seo.description', (bundle.seo as { description?: string })?.description ?? ''],
    ] as const;

    for (const [field, text] of fieldsToScan) {
      if (!text) continue;
      if (/\(null\)/i.test(text)) {
        counters.nullVisible++;
        scanText(text, ctx, field, 'null_visivel', issues);
      }
      if (/\(undefined\)|\bundefined\b/i.test(text)) {
        counters.undefinedVisible++;
        scanText(text, ctx, field, 'undefined_visivel', issues);
      }
      if (/\s0\s—\sTabela FIPE/.test(text) || /\s0$/.test(text.trim())) {
        counters.anoZeroInTitle++;
        issues.push({
          ...ctx,
          issue: 'ano_zero_no_titulo',
          field,
          sample: text.slice(0, 120),
        });
      }
    }

    const fuel = normalizeFuelType(ctx.combustivel);
    if (fuel === 'eletrico') {
      if (hasElectricLiquidFuelBug(bundle as never)) {
        counters.electricWithLiquidFuel++;
        issues.push({
          ...ctx,
          issue: 'eletrico_combustivel_liquido',
          field: 'inmetro',
          sample: JSON.stringify(bundle.inmetro).slice(0, 120),
        });
      }
      const inmetro = bundle.inmetro as Record<string, unknown> | null;
      if (inmetro && LIQUID_FUEL_ON_ELECTRIC.test(JSON.stringify(inmetro))) {
        const rows = JSON.stringify(inmetro);
        if (/consumoCidadeEtanol":\s*[5-9]/.test(rows)) {
          counters.hybridInconsistent++;
        }
      }
    }

    if (fuel === 'hibrido' || fuel === 'hibrido_plug_in') {
      const inmetro = bundle.inmetro as Record<string, unknown> | null;
      const et = inmetro?.consumoCidadeEtanol as number | undefined;
      if (et != null && et > 18 && et < 5) {
        counters.hybridInconsistent++;
        issues.push({
          ...ctx,
          issue: 'hibrido_metrica_inconsistente',
          field: 'inmetro.consumoCidadeEtanol',
          sample: String(et),
        });
      }
    }

    const ano = identity?.ano as number | undefined;
    const displayYear = identity?.displayYear as { label?: string } | undefined;
    if (ano == null || Number.isNaN(ano)) {
      counters.invalidYear++;
      issues.push({ ...ctx, issue: 'ano_invalido', field: 'identity.ano', sample: String(ano) });
    } else if (displayYear?.label && JUNK_PATTERN.test(displayYear.label)) {
      counters.invalidYear++;
      issues.push({ ...ctx, issue: 'display_year_invalido', field: 'identity.displayYear', sample: displayYear.label });
    }
  }

  const report = {
    geradoEm: new Date().toISOString(),
    bundlesAnalisados: files.length,
    resumo: counters,
    totalIssues: issues.length,
    issuesUnicas: {
      null_visivel: issues.filter((i) => i.issue === 'null_visivel').length,
      undefined_visivel: issues.filter((i) => i.issue === 'undefined_visivel').length,
      eletrico_combustivel_liquido: issues.filter((i) => i.issue === 'eletrico_combustivel_liquido').length,
      hibrido_metrica_inconsistente: issues.filter((i) => i.issue === 'hibrido_metrica_inconsistente').length,
      ano_invalido: issues.filter((i) => i.issue === 'ano_invalido').length,
      ano_zero_no_titulo: issues.filter((i) => i.issue === 'ano_zero_no_titulo').length,
    },
    amostra: issues.slice(0, 100),
    duracaoMs: Date.now() - started,
  };

  const outFile = path.join(process.cwd(), 'data', 'reports', 'data-quality-audit.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf-8');

  console.log('=== Auditoria de qualidade de dados ===');
  console.log(`Bundles: ${report.bundlesAnalisados}`);
  console.log(`(null) visível: ${report.resumo.nullVisible}`);
  console.log(`Elétricos c/ combustível líquido: ${report.resumo.electricWithLiquidFuel}`);
  console.log(`Ano zero no título: ${report.resumo.anoZeroInTitle}`);
  console.log(`Total issues: ${report.totalIssues}`);
  console.log(`Relatório: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
