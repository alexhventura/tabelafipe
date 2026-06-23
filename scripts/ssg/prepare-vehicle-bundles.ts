import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { normalizeVehicle } from '../lib/enrichment/matching-engine.js';
import { loadGenerationsCatalog, resolveGeneration } from '../lib/enrichment/generation-match.js';
import { SourceRegistry } from '../lib/enrichment/source-loaders.js';
import type { FipeVehicle, HistoricoPonto, NormalizedVehicle } from '../lib/enrichment/types.js';
import { marcaSlug, slugify } from '../lib/fipe-slug.js';
import { buildCanonicalPath, buildPageSlug } from './canonical-url.js';
import { buildVehicleSeo, formatBRL, formatPct } from './seo-builder.js';
import { runVehicleBundleAudit } from './audit-bundle-architecture.js';
import type {
  FaqItem,
  RelatedLink,
  VehiclePageBundle,
  VehiclePageSectionFlags,
  VehicleRelatedLinks,
} from './vehicle-bundle-types.js';

interface CliOptions {
  limit: number;
  dryRun: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let limit = 0;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) limit = Number(args[++i]) || 0;
    if (args[i] === '--dry-run') dryRun = true;
  }
  return { limit, dryRun };
}

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

function publicDataFile(webPath?: string): string | null {
  if (!webPath) return null;
  const rel = webPath.replace(/^\//, '');
  const p = path.join(process.cwd(), 'public', rel);
  return fs.existsSync(p) ? p : null;
}

function mapHistorico(rows: { referencia?: string; mes?: string; valor: number; data?: string }[]): HistoricoPonto[] {
  return rows.map((h) => ({ referencia: h.referencia ?? h.mes ?? '', valor: h.valor, data: h.data }));
}

function computeTrend(historico: HistoricoPonto[], months: number): number | null {
  if (historico.length < 2) return null;
  const end = historico[historico.length - 1].valor;
  const startIdx = Math.max(0, historico.length - 1 - months);
  const start = historico[startIdx].valor;
  if (!start) return null;
  return ((end - start) / start) * 100;
}

function displayName(marca: string, modelo: string, nome?: string): string {
  if (nome) return nome.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  return `${marca} ${modelo}`.trim();
}

function priceBand(valor: number): string {
  if (valor < 30000) return '0-30k';
  if (valor < 60000) return '30-60k';
  if (valor < 100000) return '60-100k';
  if (valor < 150000) return '100-150k';
  if (valor < 250000) return '150-250k';
  return '250k+';
}

function hasSpecs(rec: Record<string, unknown> | undefined): boolean {
  if (!rec) return false;
  return !!(
    rec.potencia ||
    rec.potenciaCv ||
    rec.torque ||
    rec.torqueNm ||
    rec.transmissao ||
    rec.cambio ||
    rec.porta_malas ||
    rec.portaMalasL ||
    rec.cilindrada ||
    rec.cilindradaCc
  );
}

function toEngineMasterMap(raw: { entities?: Record<string, unknown>[] | Record<string, unknown> }): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  const ents = raw.entities;
  if (!ents) return map;
  if (Array.isArray(ents)) {
    for (const e of ents) map.set(String(e.id), e);
  } else {
    for (const [id, e] of Object.entries(ents)) map.set(id, e);
  }
  return map;
}

function toMaintenanceMasterMap(raw: { entities?: Record<string, unknown>[] | Record<string, unknown> }): Record<string, Record<string, unknown>> {
  const ents = raw.entities;
  if (!ents) return {};
  if (Array.isArray(ents)) {
    const out: Record<string, Record<string, unknown>> = {};
    for (const e of ents) out[String(e.id)] = e;
    return out;
  }
  return ents as Record<string, Record<string, unknown>>;
}

function buildFaq(input: {
  displayName: string;
  ano: number;
  fipeCodigo: string;
  combustivel: string;
  valorAtual: number;
  historico: HistoricoPonto[];
  mesReferencia: string;
}): FaqItem[] {
  const { displayName: nome, ano, fipeCodigo, combustivel, valorAtual, historico, mesReferencia } = input;
  const trend6m = computeTrend(historico, 6);
  const valor6mAtras = historico.length >= 7 ? historico[historico.length - 7].valor : null;
  const faqs: FaqItem[] = [
    {
      pergunta: `Qual o valor do ${nome} ${ano} na Tabela FIPE?`,
      resposta: `O valor de referência é ${formatBRL(valorAtual)} (${mesReferencia}).`,
    },
  ];
  if (valor6mAtras !== null) {
    faqs.push({
      pergunta: `Quanto custava o ${nome} há 6 meses?`,
      resposta: `Há 6 meses o valor era ${formatBRL(valor6mAtras)}${
        trend6m !== null ? ` — variação de ${formatPct(trend6m)} no período.` : '.'
      }`,
    });
  }
  if (trend6m !== null) {
    const direcao = trend6m >= 0 ? 'valorizando' : 'desvalorizando';
    faqs.push({
      pergunta: `O ${nome} ${ano} está valorizando ou desvalorizando?`,
      resposta: `Está ${direcao} ${formatPct(Math.abs(trend6m))} nos últimos 6 meses.`,
    });
  }
  faqs.push({
    pergunta: `Qual o código FIPE do ${nome} ${ano}?`,
    resposta: `O código FIPE é ${fipeCodigo}, combustível ${combustivel}.`,
  });
  return faqs;
}

function pickRelated(ids: string[], selfId: string, meta: Map<string, VehicleMeta>, max = 6): RelatedLink[] {
  const out: RelatedLink[] = [];
  for (const id of ids) {
    if (id === selfId) continue;
    const m = meta.get(id);
    if (!m) continue;
    out.push({
      vehicleId: id,
      fipeCodigo: m.fipeCodigo,
      displayName: m.displayName,
      valorAtual: m.valorAtual,
      canonicalPath: m.canonicalPath,
      ano: m.ano,
      marca: m.marca,
    });
    if (out.length >= max) break;
  }
  return out;
}

interface VehicleMeta {
  vehicleId: string;
  marca: string;
  marcaSlug: string;
  modelo: string;
  ano: number;
  fipeCodigo: string;
  valorAtual: number;
  displayName: string;
  pageSlug: string;
  canonicalPath: string;
  band: string;
  tipo: string;
}

function resolveMaintenance(
  engineId: string | null,
  familia: string | null,
  maintenanceMaster: { entities: Record<string, Record<string, unknown>> },
  maintenanceSpecs: { registros: Record<string, Record<string, unknown>> },
  marca: string,
  modelo: string,
  ano: number,
): Record<string, unknown> | null {
  for (const ent of Object.values(maintenanceMaster.entities ?? {})) {
    const engines = (ent.engineIds as string[] | undefined) ?? [];
    const familias = (ent.familias as string[] | undefined) ?? [];
    if ((engineId && engines.includes(engineId)) || (familia && familias.includes(familia))) return ent;
  }
  const specKey = `${marca}|${modelo}|${ano}`;
  const spec = maintenanceSpecs.registros?.[specKey];
  return spec ?? null;
}

function computeSections(bundle: Omit<VehiclePageBundle, 'sections'>): VehiclePageSectionFlags {
  return {
    preco: bundle.fipe.valorAtual > 0,
    historico: bundle.fipe.historico.length > 1,
    specs: !!bundle.specs && hasSpecs(bundle.specs as unknown as Record<string, unknown>),
    engine: !!(bundle.engine?.engineId || bundle.engine?.entity),
    maintenance: !!bundle.maintenance,
    platform: !!bundle.platform?.platformId,
    transmission: !!bundle.transmission?.transmissionId,
    generation: !!bundle.generation?.geracaoId,
    inmetro: !!(
      bundle.inmetro &&
      (bundle.inmetro.consumoCidade ||
        bundle.inmetro.consumoEstrada ||
        bundle.inmetro.consumoCidadeEtanol ||
        bundle.inmetro.consumoEstradaEtanol)
    ),
    relacionados: Object.values(bundle.related).some((arr) => arr.length > 0),
  };
}

async function main() {
  const started = Date.now();
  const { limit, dryRun } = parseArgs();

  const catalogVehicles = loadJson<FipeVehicle[]>(PATHS.srcVeiculos).map((v) => normalizeVehicle(v));
  const vehicles = limit > 0 ? catalogVehicles.slice(0, limit) : catalogVehicles;

  const specsMaster = loadJson<{ veiculos: Record<string, Record<string, unknown>> }>(PATHS.specsMaster).veiculos;
  const engineMasterRaw = loadJson<{ entities?: Record<string, unknown>[] | Record<string, Record<string, unknown>> }>(PATHS.engineMaster);
  const engineMasterMap = toEngineMasterMap(engineMasterRaw);
  const engineGraph = loadJson<{ veiculos: Record<string, { engine_id: string; engine_nome?: string }> }>(
    PATHS.engineGraph,
  ).veiculos;
  const maintenanceMasterRaw = loadJson<{ entities?: Record<string, unknown>[] | Record<string, Record<string, unknown>> }>(PATHS.maintenanceMaster);
  const maintenanceMaster = { entities: toMaintenanceMasterMap(maintenanceMasterRaw) };
  const maintenanceSpecs = loadJson<{ registros: Record<string, Record<string, unknown>> }>(PATHS.maintenanceSpecs);
  const platformGraph = loadJson<{
    veiculos: Record<string, { platform_id: string; platform_nome?: string }>;
    plataformas: Record<string, Record<string, unknown>>;
  }>(PATHS.platformGraph);
  const transmissionGraph = loadJson<{ veiculos: Record<string, { transmission_id: string; transmission_nome?: string }> }>(
    PATHS.transmissionGraph,
  ).veiculos;
  const vehicleRelations = loadJson<{
    relations: Record<string, { familia: string; geracao_id: string | null; mesma_familia: string[]; mesma_geracao: string[] }>;
  }>(PATHS.vehicleRelations).relations;
  const genCatalog = loadGenerationsCatalog();

  const registry = new SourceRegistry();
  registry.loadPbev();
  registry.loadSafety();
  registry.loadRecalls();
  registry.loadWarranty();

  const meta = new Map<string, VehicleMeta>();
  for (const v of catalogVehicles) {
    const pageSlug = buildPageSlug(v.modelo, v.ano, v.fipeCodigo);
    const canonicalPath = buildCanonicalPath(v.marca, pageSlug);
    meta.set(v.id, {
      vehicleId: v.id,
      marca: v.marca,
      marcaSlug: v.marcaSlug || marcaSlug(v.marca),
      modelo: v.modelo,
      ano: v.ano,
      fipeCodigo: v.fipeCodigo,
      valorAtual: v.valor,
      displayName: displayName(v.marca, v.modelo),
      pageSlug,
      canonicalPath,
      band: priceBand(v.valor),
      tipo: v.tipo || 'carros',
    });
  }

  const engineIndex = new Map<string, string[]>();
  const platformIndex = new Map<string, string[]>();
  const transmissionIndex = new Map<string, string[]>();
  const bandIndex = new Map<string, string[]>();

  for (const v of catalogVehicles) {
    const eg = engineGraph[v.id];
    if (eg?.engine_id) {
      const list = engineIndex.get(eg.engine_id) ?? [];
      list.push(v.id);
      engineIndex.set(eg.engine_id, list);
    }
    const pg = platformGraph.veiculos[v.id];
    if (pg?.platform_id) {
      const list = platformIndex.get(pg.platform_id) ?? [];
      list.push(v.id);
      platformIndex.set(pg.platform_id, list);
    }
    const tg = transmissionGraph[v.id];
    if (tg?.transmission_id) {
      const list = transmissionIndex.get(tg.transmission_id) ?? [];
      list.push(v.id);
      transmissionIndex.set(tg.transmission_id, list);
    }
    const m = meta.get(v.id)!;
    const bandKey = `${m.tipo}|${m.band}`;
    const bl = bandIndex.get(bandKey) ?? [];
    bl.push(v.id);
    bandIndex.set(bandKey, bl);
  }

  const urlMap: Record<string, { canonicalPath: string; pageSlug: string; bundlePath: string; fipeCodigo: string }> = {};
  const shardEntries = new Map<string, { vehicleId: string; canonicalPath: string; bundlePath: string }[]>();
  const bundleSizes: number[] = [];

  for (const v of vehicles) {
    const vm = meta.get(v.id)!;
    const rel = vehicleRelations[v.id];
    const specRec = specsMaster[v.id];
    const eg = engineGraph[v.id];
    const pg = platformGraph.veiculos[v.id];
    const tg = transmissionGraph[v.id];

    let historico: HistoricoPonto[] = [];
    let valorAtual = v.valor;
    let mesReferencia = v.mesReferencia;
    let nomeHistorico: string | undefined;

    const historyFile = path.join(PATHS.historyRoot, `${v.id}.json`);
    if (fs.existsSync(historyFile)) {
      const hist = loadJson<{
        historico?: { referencia?: string; mes?: string; valor: number; data?: string }[];
        metricas?: unknown;
      }>(historyFile);
      if (hist.historico?.length) historico = mapHistorico(hist.historico);
    }

    const histFile = publicDataFile(v.dataPath);
    if (histFile) {
      const raw = loadJson<{
        historicoPrecos?: { mes?: string; referencia?: string; valor: number }[];
        valorAtual?: number;
        valor?: number;
        mesReferencia?: string;
        nome?: string;
      }>(histFile);
      if (!historico.length && raw.historicoPrecos?.length) historico = mapHistorico(raw.historicoPrecos);
      valorAtual = raw.valorAtual ?? raw.valor ?? valorAtual;
      mesReferencia = raw.mesReferencia ?? mesReferencia;
      nomeHistorico = raw.nome;
    }

    if (historico.length && valorAtual <= 0) {
      valorAtual = historico[historico.length - 1].valor;
    }

    const display = displayName(v.marca, v.modelo, nomeHistorico);
    vm.displayName = display;
    vm.valorAtual = valorAtual;

    const specsFromMaster = specRec
      ? {
          potenciaCv: (specRec.potencia as number | undefined) ?? null,
          torqueNm: (specRec.torque as number | undefined) ?? null,
          cilindradaCc: (specRec.cilindrada as number | undefined) ?? null,
          cambio: (specRec.transmissao as string | undefined) ?? null,
          pesoKg: null,
          comprimentoMm: null,
          larguraMm: null,
          alturaMm: null,
          portaMalasL: (specRec.porta_malas as number | undefined) ?? null,
          tanqueL: (specRec.tanque as number | undefined) ?? null,
          aceleracao0a100: null,
          velocidadeMaxKmh: null,
          fonte: (specRec.fonte as string | undefined) ?? null,
        }
      : null;

    const mfrSpecs = registry.matchManufacturer(v.marca, v.modelo, v.ano);
    const specs = specsFromMaster && hasSpecs(specsFromMaster as unknown as Record<string, unknown>) ? specsFromMaster : mfrSpecs;

    const staticMatch = registry.matchStaticSpecs(v.id);
    const inmetro = registry.matchInmetro(v.marca, v.modelo) ?? staticMatch.inmetro;

    const engineEntity = eg?.engine_id ? engineMasterMap.get(eg.engine_id) ?? null : null;
    const platformEntity = pg?.platform_id ? platformGraph.plataformas[pg.platform_id] ?? null : null;

    const maintenance = resolveMaintenance(
      eg?.engine_id ?? null,
      rel?.familia ?? null,
      maintenanceMaster,
      maintenanceSpecs,
      v.marca,
      v.modelo,
      v.ano,
    );

    const genResolved = resolveGeneration(v.marca, v.modeloSlug ?? slugify(v.modelo), v.ano, genCatalog);
    const generation = {
      geracaoId: rel?.geracao_id ?? genResolved?.id ?? null,
      familia: rel?.familia ?? null,
      catalogEntry: genResolved ? (genResolved as unknown as Record<string, unknown>) : null,
    };

    const safety = registry.matchSafety(v.marca, v.modelo, v.ano);
    const recalls = registry.matchRecalls(v.marca, v.modelo, v.ano);
    const warranty = registry.matchWarranty(v.marca);

    const related: VehicleRelatedLinks = {
      mesmaGeracao: pickRelated(rel?.mesma_geracao ?? [], v.id, meta),
      mesmaFamilia: pickRelated(rel?.mesma_familia ?? [], v.id, meta),
      mesmaPlataforma: pickRelated(pg?.platform_id ? platformIndex.get(pg.platform_id) ?? [] : [], v.id, meta),
      mesmoMotor: pickRelated(eg?.engine_id ? engineIndex.get(eg.engine_id) ?? [] : [], v.id, meta),
      mesmaTransmissao: pickRelated(tg?.transmission_id ? transmissionIndex.get(tg.transmission_id) ?? [] : [], v.id, meta),
      mesmaFaixaPreco: pickRelated(bandIndex.get(`${vm.tipo}|${vm.band}`) ?? [], v.id, meta),
      concorrentes: pickRelated(
        (bandIndex.get(`${vm.tipo}|${vm.band}`) ?? []).filter((id) => meta.get(id)?.marcaSlug !== vm.marcaSlug),
        v.id,
        meta,
      ),
    };

    const faq = buildFaq({
      displayName: display,
      ano: v.ano,
      fipeCodigo: v.fipeCodigo,
      combustivel: v.combustivel,
      valorAtual,
      historico,
      mesReferencia,
    });

    const specsLine = specs?.potenciaCv ? `${specs.potenciaCv} cv` : undefined;
    const seo = buildVehicleSeo({
      marca: v.marca,
      marcaSlug: vm.marcaSlug,
      displayName: display,
      ano: v.ano,
      fipeCodigo: v.fipeCodigo,
      valorAtual,
      pageSlug: vm.pageSlug,
      specsLine,
      faq,
    });

    const bundlePath = `/data/bundles/${vm.marcaSlug}/${vm.pageSlug}.json`;
    const partial: Omit<VehiclePageBundle, 'sections'> = {
      geradoEm: new Date().toISOString(),
      bundlePath,
      identity: {
        vehicleId: v.id,
        marca: v.marca,
        marcaSlug: vm.marcaSlug,
        modelo: v.modelo,
        ano: v.ano,
        anoModelo: v.ano,
        combustivel: v.combustivel,
        tipo: v.tipo,
        displayName: display,
        pageSlug: vm.pageSlug,
      },
      fipe: {
        fipeCodigo: v.fipeCodigo,
        valorAtual,
        mesReferencia,
        historico,
        trend6m: computeTrend(historico, 6),
      },
      specs,
      engine: eg
        ? {
            engineId: eg.engine_id ?? null,
            engineNome: eg.engine_nome ?? null,
            entity: engineEntity,
          }
        : null,
      maintenance,
      platform: pg
        ? {
            platformId: pg.platform_id ?? null,
            platformNome: pg.platform_nome ?? null,
            entity: platformEntity,
          }
        : null,
      transmission: tg
        ? {
            transmissionId: tg.transmission_id ?? null,
            transmissionNome: tg.transmission_nome ?? null,
          }
        : null,
      generation,
      inmetro,
      safety,
      recalls,
      warranty,
      related,
      faq,
      seo,
    };

    const sections = computeSections(partial);
    const bundle: VehiclePageBundle = { ...partial, sections };

    urlMap[v.id] = {
      canonicalPath: vm.canonicalPath,
      pageSlug: vm.pageSlug,
      bundlePath,
      fipeCodigo: v.fipeCodigo,
    };

    const shardKey = (vm.marcaSlug[0] ?? 'a').toLowerCase();
    const shardList = shardEntries.get(shardKey) ?? [];
    shardList.push({ vehicleId: v.id, canonicalPath: vm.canonicalPath, bundlePath });
    shardEntries.set(shardKey, shardList);

    if (!dryRun) {
      const outFile = path.join(PATHS.vehicleBundlesRoot, vm.marcaSlug, `${vm.pageSlug}.json`);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      const json = JSON.stringify(bundle);
      fs.writeFileSync(outFile, json, 'utf-8');
      bundleSizes.push(Buffer.byteLength(json, 'utf-8'));
    }
  }

  const avgBundleBytes = bundleSizes.length
    ? Math.round(bundleSizes.reduce((a, b) => a + b, 0) / bundleSizes.length)
    : 0;
  const shards = [...shardEntries.keys()].sort();

  if (!dryRun) {
    fs.mkdirSync(PATHS.generatedRoot, { recursive: true });
    fs.writeFileSync(PATHS.vehicleUrlMap, JSON.stringify(urlMap, null, 2), 'utf-8');
    fs.mkdirSync(path.dirname(PATHS.publicVehicleUrlMap), { recursive: true });
    fs.writeFileSync(PATHS.publicVehicleUrlMap, JSON.stringify(urlMap), 'utf-8');
    fs.mkdirSync(PATHS.vehicleBundlesRoot, { recursive: true });
    fs.writeFileSync(
      PATHS.vehicleBundleManifest,
      JSON.stringify(
        {
          total: vehicles.length,
          geradoEm: new Date().toISOString(),
          shards,
          avgBundleBytes,
        },
        null,
        2,
      ),
      'utf-8',
    );
    for (const [letter, entries] of shardEntries) {
      fs.writeFileSync(
        path.join(PATHS.vehicleBundlesRoot, `manifest-${letter}.json`),
        JSON.stringify(entries, null, 2),
        'utf-8',
      );
    }
  }

  const elapsedMs = Date.now() - started;
  console.log(
    JSON.stringify({
      total: vehicles.length,
      dryRun,
      avgBundleBytes,
      elapsedMs,
      sampleCanonical: vehicles[0] ? urlMap[vehicles[0].id]?.canonicalPath : null,
    }),
  );

  if (!dryRun) {
    const audit = runVehicleBundleAudit({ sampleSize: Math.min(500, vehicles.length) });
    console.log(
      JSON.stringify({
        audit: {
          total_pages_generated: audit.total_pages_generated,
          avg_bytes: audit.bundle_size.avg_bytes,
          section_coverage_pct: audit.section_coverage_pct,
        },
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
