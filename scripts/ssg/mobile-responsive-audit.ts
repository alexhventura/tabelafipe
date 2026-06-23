/**
 * Auditoria estática de responsividade mobile (320–430px).
 * Verifica classes e padrões nos componentes críticos.
 * Uso: npx tsx scripts/ssg/mobile-responsive-audit.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PATHS } from '../lib/fipe-paths.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const VIEWPORTS = [320, 375, 390, 430];

type Check = {
  area: string;
  file: string;
  patterns: RegExp[];
  minMatches?: number;
};

const CHECKS: Check[] = [
  {
    area: 'Busca (SearchBox)',
    file: 'src/components/search/SearchBox.tsx',
    patterns: [/min-h-\[56px\]/, /line-clamp-2/, /role="listbox"/, /rounded-xl/],
  },
  {
    area: 'Dropdown compacto',
    file: 'src/components/search/SearchBox.tsx',
    patterns: [/max-h-\[min\(60vh/, /overflow-y-auto/],
  },
  {
    area: 'Hero veículo',
    file: 'src/components/vehicle/VehiclePageSections.tsx',
    patterns: [/text-3xl/, /sm:text-4xl/, /line-clamp-2/, /p-4/],
  },
  {
    area: 'Gráfico',
    file: 'src/components/vehicle/PriceChart.tsx',
    patterns: [/ResponsiveContainer|width|100%|min-h/],
    minMatches: 1,
  },
  {
    area: 'FAQ',
    file: 'src/components/vehicle/VehiclePageSections.tsx',
    patterns: [/min-h-\[44px\]/, /details/, /summary/],
  },
  {
    area: 'Concorrentes',
    file: 'src/components/vehicle/VehiclePageSections.tsx',
    patterns: [/sm:grid-cols-2/, /min-h-\[56px\]/],
  },
  {
    area: 'Breadcrumb',
    file: 'src/components/vehicle/VehicleBreadcrumb.tsx',
    patterns: [/line-clamp-1/, /flex-wrap/, /BreadcrumbJsonLd/],
  },
  {
    area: 'Home busca',
    file: 'src/pages/HomePage.tsx',
    patterns: [/SearchBox/, /px-4/, /max-w/],
  },
];

function readSafe(rel: string): string {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf-8');
}

function main() {
  const results = CHECKS.map((check) => {
    const content = readSafe(check.file);
    const matched = check.patterns.filter((p) => p.test(content));
    const min = check.minMatches ?? check.patterns.length;
    const ok = content.length > 0 && matched.length >= min;
    return {
      area: check.area,
      file: check.file,
      ok,
      patternsOk: matched.length,
      patternsTotal: check.patterns.length,
      missing: ok
        ? []
        : check.patterns.filter((p) => !p.test(content)).map((p) => p.source),
    };
  });

  const report = {
    geradoEm: new Date().toISOString(),
    viewportsAlvo: VIEWPORTS,
    areasVerificadas: results.length,
    areasOk: results.filter((r) => r.ok).length,
    resultados: results,
    checklistManual: VIEWPORTS.map((w) => ({
      larguraPx: w,
      itens: [
        'Busca: campo e dropdown não cortam texto',
        'Dropdown: scrollável, toque em item ≥ 44px',
        'Hero: preço visível sem scroll',
        'Gráfico: não transborda horizontalmente',
        'FAQ: summary clicável em touch',
        'Concorrentes: grid em 1 coluna',
        'Breadcrumb: quebra de linha sem overflow',
      ],
    })),
    metas: {
      todasAreasOk: results.every((r) => r.ok),
    },
    nota: 'Auditoria estática de código. Validação visual requer teste em dispositivo ou DevTools.',
  };

  const outPath = path.join(PATHS.reportsRoot, 'mobile-responsive-audit.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.metas.todasAreasOk ? 0 : 1);
}

main();
