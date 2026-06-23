/**
 * Auditoria UX/UI Release 1.0 — homepage, rodapé, fontes e responsividade.
 * Uso: npx tsx scripts/ssg/homepage-audit.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PATHS } from '../lib/fipe-paths.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'src');

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf-8');
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(SRC, rel));
}

function bundleSample(n = 200): string[] {
  const root = PATHS.vehicleBundlesRoot;
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.json')) files.push(full);
    }
  };
  walk(root);
  const step = Math.max(1, Math.floor(files.length / n));
  return files.filter((_, i) => i % step === 0).slice(0, n);
}

const SEARCH_EXAMPLES = ['Corolla XEi 2024', 'HB20 Comfort Plus 2022', 'Strada Volcano 2023', '002112-1'];

async function main() {
  const t0 = Date.now();
  const home = read('pages/HomePage.tsx');
  const siteMeta = read('lib/siteMeta.ts');
  const footer = read('components/layout/Footer.tsx');
  const vehicleSections = read('components/vehicle/VehiclePageSections.tsx');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  const indexCss = read('index.css');

  const technicalPollution: string[] = [];
  if (/totalFamilies|total\s*\|\|/.test(home)) technicalPollution.push('métricas de catálogo na home');
  if (/veículos\s*·\s*|famílias/.test(home)) technicalPollution.push('contadores veículos/famílias');
  if (/relatório|dashboard/i.test(home)) technicalPollution.push('jargão técnico visível');

  const duplicateLabels = home.includes('Consulta Tabela') && home.includes('Pesquisa');

  const homepageChecks = {
    heroTitulo: home.includes('Tabela FIPE Completa'),
    heroSubtitulo: home.includes('Consulte preços FIPE, histórico'),
    placeholderCorreto: home.includes('Digite marca, modelo, versão, ano ou código FIPE'),
    exemplosBusca: SEARCH_EXAMPLES.every((ex) => home.includes(ex)),
    secaoPorQue: home.includes('Por que consultar aqui?'),
    secaoPopulares: home.includes('Veículos mais pesquisados'),
    secaoMarcas: home.includes('Marcas'),
    secaoFaq: home.includes('Perguntas frequentes'),
    semMetricasInternas: !/veículos ·|famílias/.test(home),
    semDuplicidadeConsultaPesquisa: !duplicateLabels,
    brandLogo: exists('components/brand/BrandLogo.tsx'),
  };

  const footerLinks = [
    'Sobre',
    'Metodologia',
    'Fontes dos dados',
    'Política de Privacidade',
    'Política de Cookies',
    'Termos de Uso',
    'Contato',
  ];
  const footerChecks = Object.fromEntries(
    footerLinks.map((label) => [label, siteMeta.includes(label)]),
  ) as Record<string, boolean>;

  const footerLegal = siteMeta.includes('As informações exibidas são obtidas de fontes públicas');
  const footerVersion = siteMeta.includes('SITE_VERSION') && footer.includes('SITE_VERSION');

  const responsividade = {
    viewportMeta: indexHtml.includes('width=device-width'),
    overflowXHidden: indexCss.includes('overflow-x: hidden') || indexCss.includes('overflow-x-hidden'),
    breakpointsTailwind: true,
    largurasValidar: [320, 375, 390, 768, 1024, 1440, 1920],
  };

  const acessibilidade = {
    searchAriaLabel: home.includes('aria-label="Busca de veículos"') || home.includes('role="search"'),
    faqDetails: home.includes('<details'),
    srOnlyLabel: read('components/search/SearchBox.tsx').includes('sr-only'),
  };

  const fontesVeiculo = {
    secaoExiste: vehicleSections.includes('Fontes e referências'),
    secaoId: vehicleSections.includes('sec-fontes'),
    libExiste: exists('lib/vehicleSources.ts'),
  };

  const samples = bundleSample(150);
  let comHistorico = 0;
  let comFipe = 0;
  let comFontesUi = 0;
  for (const file of samples) {
    const b = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      fipe?: { valorAtual?: number; historico?: unknown[] };
      sections?: { historico?: boolean };
    };
    if (b.fipe?.valorAtual) comFipe++;
    if (b.fipe?.historico && b.fipe.historico.length > 1) comHistorico++;
  }
  comFontesUi = fontesVeiculo.secaoExiste ? samples.length : 0;

  const infoRoutes = [
    'sobre',
    'metodologia',
    'fontes-dados',
    'privacidade',
    'cookies',
    'termos',
    'contato',
  ];
  const linksQuebrados = infoRoutes.filter(
    (slug) => !read('content/infoPages.ts').includes(`'${slug}'`),
  );

  const report = {
    geradoEm: new Date().toISOString(),
    duracaoMs: Date.now() - t0,
    release: '1.0.0',
    homepage: homepageChecks,
    poluicaoTecnica: technicalPollution,
    rodape: { links: footerChecks, textoLegal: footerLegal, versao: footerVersion },
    responsividade,
    acessibilidade,
    performance: {
      nota: 'Executar Lighthouse em produção ou preview (npm run build && npm run preview)',
      metas: { LCP_ms: 2000, CLS: 0.05, INP_ms: 100, lighthouseMin: 95 },
    },
    fontesVeiculo,
    coberturaBundles: {
      amostrados: samples.length,
      comPrecoFipe: comFipe,
      comHistorico,
      percentualHistorico: samples.length ? Math.round((comHistorico / samples.length) * 1000) / 10 : 0,
    },
    linksInstitucionais: {
      definidos: infoRoutes.length,
      faltando: linksQuebrados,
    },
    secoesVazias: {
      nota: 'Seções condicionais na página do veículo ocultam blocos sem dados — comportamento esperado',
    },
    metas: {
      homepageProfissional:
        Object.values(homepageChecks).every(Boolean) && technicalPollution.length === 0,
      rodapeCompleto: Object.values(footerChecks).every(Boolean) && footerLegal && footerVersion,
      fontesNaPaginaVeiculo: fontesVeiculo.secaoExiste && fontesVeiculo.libExiste,
      responsividadeBase: responsividade.viewportMeta && responsividade.overflowXHidden,
    },
  };

  const out = path.join(PATHS.reportsRoot, 'homepage-audit.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf-8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
