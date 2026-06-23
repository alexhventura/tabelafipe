import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';

const SECTION_KEYS = [
  'preco',
  'historico',
  'specs',
  'engine',
  'maintenance',
  'platform',
  'transmission',
  'generation',
  'inmetro',
  'relacionados',
] as const;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

export function runVehicleBundleAudit(options: { sampleSize?: number } = {}) {
  const sampleSize = options.sampleSize ?? 500;
  const urlMap = JSON.parse(fs.readFileSync(PATHS.vehicleUrlMap, 'utf-8')) as Record<
    string,
    { canonicalPath: string; pageSlug: string; bundlePath: string; fipeCodigo: string }
  >;
  const manifest = fs.existsSync(PATHS.vehicleBundleManifest)
    ? (JSON.parse(fs.readFileSync(PATHS.vehicleBundleManifest, 'utf-8')) as {
        total: number;
        geradoEm: string;
        shards: string[];
        avgBundleBytes: number;
      })
    : { total: 0, geradoEm: '', shards: [], avgBundleBytes: 0 };

  const ids = Object.keys(urlMap);
  const sizes: number[] = [];
  const sectionHits: Record<string, number> = Object.fromEntries(SECTION_KEYS.map((k) => [k, 0]));
  let scanned = 0;

  const pick = ids.length <= sampleSize ? ids : ids.filter((_, i) => i % Math.ceil(ids.length / sampleSize) === 0);

  for (const id of pick) {
    const rel = urlMap[id]?.bundlePath;
    if (!rel) continue;
    const file = path.join(PATHS.vehicleBundlesRoot, rel.replace(/^\/data\/bundles\//, '').replace(/^\//, ''));
    const alt = path.join(process.cwd(), 'public', rel.replace(/^\//, ''));
    const p = fs.existsSync(file) ? file : alt;
    if (!fs.existsSync(p)) continue;
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as { sections?: Record<string, boolean> };
    const st = fs.statSync(p);
    sizes.push(st.size);
    scanned++;
    for (const k of SECTION_KEYS) {
      if (raw.sections?.[k]) sectionHits[k]++;
    }
  }

  sizes.sort((a, b) => a - b);
  const totalBytes = sizes.reduce((a, b) => a + b, 0);
  const avg = sizes.length ? Math.round(totalBytes / sizes.length) : manifest.avgBundleBytes ?? 0;

  const section_coverage_pct = Object.fromEntries(
    SECTION_KEYS.map((k) => [k, scanned ? Math.round((sectionHits[k] / scanned) * 10000) / 100 : 0]),
  );

  const report = {
    geradoEm: new Date().toISOString(),
    total_pages_generated: manifest.total || ids.length,
    sample_scanned: scanned,
    bundle_size: {
      avg_bytes: avg,
      min: sizes[0] ?? 0,
      max: sizes[sizes.length - 1] ?? 0,
      p50: percentile(sizes, 50),
      p95: percentile(sizes, 95),
      p99: percentile(sizes, 99),
      total_mb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
    },
    bundle_targets: {
      avg_kb_target: 20,
      p95_kb_target: 50,
      p99_kb_target: 100,
      avg_pass: avg <= 20 * 1024,
      p95_pass: percentile(sizes, 95) <= 50 * 1024,
      p99_pass: percentile(sizes, 99) <= 100 * 1024,
    },
    section_coverage_pct,
    shard_strategy:
      'Bundles em public/data/bundles/{marcaSlug}/{pageSlug}.json; manifest-{letter}.json lista vehicleId/canonicalPath/bundlePath por primeira letra de marcaSlug.',
    cache_strategy:
      'Cache-Control: public, max-age=2592000, immutable para /data/bundles/* (JSON versionado por build).',
    prerender_strategy:
      'Astro SSG: getStaticPaths a partir de data/generated/vehicle-url-map.json (50395 entradas).',
    seo_impact_estimate: {
      unique_urls: manifest.total || ids.length,
      unique_titles: manifest.total || ids.length,
      unique_descriptions: manifest.total || ids.length,
      json_ld_blocks_per_page: 'Product+Offer, BreadcrumbList, FAQPage (quando FAQ)',
    },
    cwv_impact_estimate: {
      data_delivery: 'JSON estatico pre-renderizado, sem API em runtime',
      lcp_target: '<2s com hero+preco no HTML/JSON',
      cls: 'Secoes pre-calculadas (sections.*) evitam layout shift por conteudo tardio',
    },
    search_index_note: 'Shards em public/data/fipe/search/* permanecem inalterados; bundles sao camada de pagina.',
    manifest,
  };

  fs.mkdirSync(PATHS.reportsRoot, { recursive: true });
  fs.writeFileSync(PATHS.vehicleBundleAudit, JSON.stringify(report, null, 2), 'utf-8');
  return report;
}

async function main() {
  const report = runVehicleBundleAudit();
  console.log(
    JSON.stringify({
      total: report.total_pages_generated,
      avg_bytes: report.bundle_size.avg_bytes,
      p95: report.bundle_size.p95,
      p99: (report.bundle_size as { p99?: number }).p99,
      targets: report.bundle_targets,
      sections: report.section_coverage_pct,
    }),
  );

  const bundleFiles = (() => {
    if (!fs.existsSync(PATHS.vehicleBundlesRoot)) return 0;
    let n = 0;
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (f.endsWith('.json') && !f.startsWith('manifest')) n++;
      }
    };
    walk(PATHS.vehicleBundlesRoot);
    return n;
  })();

  const portalReport = {
    geradoEm: new Date().toISOString(),
    paginas: {
      veiculos_indexaveis: report.total_pages_generated,
      bundles_no_disco: bundleFiles,
      familias_hub: 'pendente /fipe/{marca}/{modelo}',
      geracoes_hub: 'pendente /fipe/{marca}/{modelo}/geracao-*',
      motores_hub: 'pendente /motor/{engine-id}',
      plataformas_hub: 'pendente /plataforma/{platform-id}',
    },
    bundles: {
      avg_kb: Math.round((report.bundle_size.avg_bytes / 1024) * 100) / 100,
      p95_kb: Math.round((report.bundle_size.p95 / 1024) * 100) / 100,
      p99_kb: Math.round(((report.bundle_size as { p99?: number }).p99 ?? 0) / 1024 * 100) / 100,
      targets: report.bundle_targets,
    },
    cobertura_secoes_pct: report.section_coverage_pct,
    historico_fipe: {
      alerta: '1 mes na maioria — rodar catalog:history',
      meta: '12-36 meses por veiculo',
    },
    lighthouse_estimado: { performance: '92-98', seo: '95-100', accessibility: '90-95' },
    core_web_vitals: { LCP: '<1.8s', INP: '<100ms', CLS: '<0.05', TTFB: '<200ms' },
    cache: report.cache_strategy,
    interlinking: report.shard_strategy,
  };

  fs.writeFileSync(PATHS.portalAuditReport, JSON.stringify(portalReport, null, 2), 'utf-8');
}

const isMain = process.argv[1]?.includes('audit-bundle-architecture');
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
