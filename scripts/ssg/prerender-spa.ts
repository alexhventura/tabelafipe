/**
 * Pré-renderiza HTML estático para SEO mantendo a SPA React.
 * Gera páginas em dist/ a partir dos bundles JSON já existentes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INFO_PAGES } from '../../src/content/infoPages.ts';
import { PATHS } from '../lib/fipe-paths.js';
import {
  buildFamilyHubBody,
  buildHomeBody,
  buildInfoBody,
  buildPrerenderedHtml,
  buildVehicleBody,
  canonicalPathToOutFile,
  VEHICLE_BUNDLE_EMBED_ID,
  type PrerenderSeo,
} from './prerender/html-shell.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://pesquisatabelafipe.com.br';

interface UrlMapEntry {
  canonicalPath: string;
  pageSlug: string;
  bundlePath: string;
}

function parseLimit(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writePage(filePath: string, html: string): void {
  ensureDir(filePath);
  fs.writeFileSync(filePath, html, 'utf-8');
}

function publicDataPath(relative: string): string {
  return path.join(ROOT, 'public', relative.replace(/^\/+/, ''));
}

function loadBaseHtml(): string {
  const indexPath = path.join(DIST, 'index.html');
  const shellPath = path.join(DIST, '_spa-shell.html');
  if (!fs.existsSync(indexPath)) {
    console.error('prerender-spa: dist/index.html não encontrado. Rode vite build antes.');
    process.exit(1);
  }
  if (!fs.existsSync(shellPath)) {
    fs.copyFileSync(indexPath, shellPath);
  }
  return fs.readFileSync(shellPath, 'utf-8');
}

function prerenderStaticPages(baseHtml: string): number {
  let count = 0;

  const homeSeo: PrerenderSeo = {
    title: 'Tabela FIPE Completa — PesquisaTabelaFIPE',
    description:
      'Consulte preços FIPE, histórico, ficha técnica, consumo, manutenção, segurança e informações completas do seu veículo.',
    canonical: `${SITE_URL}/`,
    og: {
      'og:type': 'website',
      'og:title': 'Tabela FIPE Completa — PesquisaTabelaFIPE',
      'og:description':
        'Consulte preços FIPE, histórico, ficha técnica, consumo, manutenção, segurança e informações completas do seu veículo.',
      'og:url': `${SITE_URL}/`,
      'og:site_name': 'PesquisaTabelaFIPE',
      'og:locale': 'pt_BR',
    },
    twitter: {
      'twitter:card': 'summary',
      'twitter:title': 'Tabela FIPE Completa — PesquisaTabelaFIPE',
      'twitter:description':
        'Consulte preços FIPE, histórico, ficha técnica, consumo, manutenção, segurança e informações completas do seu veículo.',
    },
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'PesquisaTabelaFIPE',
        url: SITE_URL,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/busca?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  const homeHtml = buildPrerenderedHtml(baseHtml, homeSeo, buildHomeBody());
  writePage(path.join(DIST, 'index.html'), homeHtml);
  count += 1;

  for (const [slug, page] of Object.entries(INFO_PAGES)) {
    const canonical = `${SITE_URL}/${slug}/`;
    const title = `${page.title} — PesquisaTabelaFIPE`;
    const seo: PrerenderSeo = {
      title,
      description: page.description,
      canonical,
      og: {
        'og:type': 'website',
        'og:title': title,
        'og:description': page.description,
        'og:url': canonical,
        'og:site_name': 'PesquisaTabelaFIPE',
        'og:locale': 'pt_BR',
      },
      twitter: {
        'twitter:card': 'summary',
        'twitter:title': title,
        'twitter:description': page.description,
      },
    };
    const paragraphs = page.sections.flatMap((section) => section.paragraphs);
    const html = buildPrerenderedHtml(
      baseHtml,
      seo,
      buildInfoBody(page.title, page.description, paragraphs),
    );
    writePage(path.join(DIST, slug, 'index.html'), html);
    count += 1;
  }

  return count;
}

function prerenderVehicles(baseHtml: string): { written: number; skipped: number } {
  const mapPath = fs.existsSync(PATHS.publicVehicleUrlMap)
    ? PATHS.publicVehicleUrlMap
    : PATHS.vehicleUrlMap;
  if (!fs.existsSync(mapPath)) {
    console.warn('prerender-spa: vehicle-url-map ausente, pulando veículos.');
    return { written: 0, skipped: 0 };
  }

  const urlMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8')) as Record<string, UrlMapEntry>;
  const limit = parseLimit('SSG_LIMIT_VEHICLES');
  let written = 0;
  let skipped = 0;

  for (const entry of Object.values(urlMap)) {
    if (limit !== null && written >= limit) break;

    const bundleFile = publicDataPath(entry.bundlePath);
    if (!fs.existsSync(bundleFile)) {
      skipped += 1;
      continue;
    }

    const bundle = JSON.parse(fs.readFileSync(bundleFile, 'utf-8')) as Parameters<
      typeof buildVehicleBody
    >[0];
    if (!bundle?.seo) {
      skipped += 1;
      continue;
    }

    const html = buildPrerenderedHtml(baseHtml, bundle.seo as PrerenderSeo, buildVehicleBody(bundle), {
      embedJson: { id: VEHICLE_BUNDLE_EMBED_ID, data: bundle },
    });
    writePage(canonicalPathToOutFile(DIST, entry.canonicalPath), html);
    written += 1;

    if (written % 5000 === 0) {
      console.log(`prerender-spa: ${written} veículos...`);
    }
  }

  return { written, skipped };
}

function walkJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function prerenderFamilyHubs(baseHtml: string): number {
  const hubRoot = path.join(PATHS.hubBundlesRoot, 'familia');
  const files = walkJsonFiles(hubRoot);
  const limit = parseLimit('SSG_LIMIT_FAMILIES');
  let written = 0;

  for (const file of files) {
    if (limit !== null && written >= limit) break;

    const hub = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      canonicalPath?: string;
      seo?: PrerenderSeo & { h1?: string };
      titulo?: string;
      descricao?: string;
      veiculos?: Parameters<typeof buildFamilyHubBody>[0]['veiculos'];
    };

    const canonicalPath = hub.canonicalPath ?? hub.seo?.canonical?.replace(SITE_URL, '');
    if (!canonicalPath || !hub.seo) continue;

    const html = buildPrerenderedHtml(
      baseHtml,
      hub.seo,
      buildFamilyHubBody({
        titulo: hub.titulo,
        descricao: hub.descricao,
        seo: hub.seo,
        veiculos: hub.veiculos,
      }),
    );
    writePage(canonicalPathToOutFile(DIST, canonicalPath), html);
    written += 1;
  }

  return written;
}

function countHtmlFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countHtmlFiles(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) count += 1;
  }
  return count;
}

function main(): void {
  const started = Date.now();
  console.log('=== SPA Prerender (SEO) ===');

  const baseHtml = loadBaseHtml();
  const staticCount = prerenderStaticPages(baseHtml);
  const vehicles = prerenderVehicles(baseHtml);
  const hubs = prerenderFamilyHubs(baseHtml);
  const totalHtml = countHtmlFiles(DIST);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Páginas estáticas: ${staticCount}`);
  console.log(`Veículos: ${vehicles.written} (${vehicles.skipped} sem bundle)`);
  console.log(`Hubs família: ${hubs}`);
  console.log(`Total HTML em dist/: ${totalHtml}`);
  console.log(`Concluído em ${elapsed}s`);

  const limit = parseLimit('SSG_LIMIT_VEHICLES');
  const minExpected = limit ? Math.max(10, Math.floor(limit * 0.9)) : 1000;
  if (vehicles.written < minExpected) {
    console.error('prerender-spa: poucas páginas geradas — verifique bundles em public/data/bundles');
    process.exit(1);
  }
}

main();
