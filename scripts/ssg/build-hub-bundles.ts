import fs from 'fs';
import path from 'path';
import { PATHS } from '../lib/fipe-paths.js';
import { marcaSlug, modeloSlug } from '../lib/fipe-slug.js';
import { SITE_URL } from './canonical-url.js';

type UrlEntry = { canonicalPath: string; pageSlug: string; bundlePath: string; fipeCodigo: string };
type RelatedLink = {
  vehicleId: string;
  fipeCodigo: string;
  displayName: string;
  valorAtual: number;
  canonicalPath: string;
  ano: number;
  marca: string;
};

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

function vehDisplayName(marca: string, modelo: string): string {
  return `${marca} ${modelo}`.trim();
}

function buildHubVeiculo(
  id: string,
  v: { marca: string; modelo: string; ano: number; fipeCodigo: string; valor: number },
  url: UrlEntry,
): RelatedLink {
  return {
    vehicleId: id,
    fipeCodigo: v.fipeCodigo,
    displayName: vehDisplayName(v.marca, v.modelo),
    valorAtual: v.valor,
    canonicalPath: url.canonicalPath,
    ano: v.ano,
    marca: v.marca,
  };
}

async function main() {
  const veiculos = loadJson<
    Array<{ id: string; marca: string; modelo: string; ano: number; fipeCodigo: string; valor: number }>
  >(PATHS.srcVeiculos);
  const urlMap = loadJson<Record<string, UrlEntry>>(PATHS.vehicleUrlMap);
  const relations = loadJson<{
    relations: Record<string, { familia: string; geracao_id: string | null }>;
  }>(PATHS.vehicleRelations).relations;

  const byFamilia = new Map<string, string[]>();
  for (const v of veiculos) {
    const fam = relations[v.id]?.familia ?? `${marcaSlug(v.marca)}|${modeloSlug(v.modelo)}`;
    const list = byFamilia.get(fam) ?? [];
    list.push(v.id);
    byFamilia.set(fam, list);
  }

  const engineGraph = fs.existsSync(PATHS.engineGraph)
    ? loadJson<{ veiculos: Record<string, { engine_id: string; engine_nome?: string }> }>(PATHS.engineGraph).veiculos ?? {}
    : {};
  const platformGraph = fs.existsSync(PATHS.platformGraph)
    ? loadJson<{ veiculos: Record<string, { platform_id: string; platform_nome?: string }> }>(PATHS.platformGraph).veiculos ?? {}
    : {};

  const vehById = new Map(veiculos.map((v) => [v.id, v]));
  const manifest = { familia: 0, geracao: 0, motor: 0, plataforma: 0 };

  fs.mkdirSync(path.join(PATHS.hubBundlesRoot, 'familia'), { recursive: true });

  for (const [famKey, ids] of byFamilia) {
    if (ids.length < 2) continue;
    const [mSlug, modSlug] = famKey.split('|');
    const links: RelatedLink[] = [];
    for (const id of ids) {
      const v = vehById.get(id);
      const u = urlMap[id];
      if (!v || !u) continue;
      links.push(buildHubVeiculo(id, v, u));
    }
    if (links.length < 2) continue;
    links.sort((a, b) => b.ano - a.ano || a.valorAtual - b.valorAtual);
    const valores = links.map((l) => l.valorAtual).filter((x) => x > 0);
    const marcaNome = links[0].marca;
    const canonicalPath = `/fipe/${mSlug}/${modSlug}/`;
    const titulo = `${marcaNome} ${modSlug.replace(/-/g, ' ')} - Tabela FIPE`;
    const hub = {
      tipo: 'familia' as const,
      slug: modSlug,
      canonicalPath,
      titulo,
      descricao: `${links.length} versoes e anos do ${marcaNome} ${modSlug.replace(/-/g, ' ')} na Tabela FIPE.`,
      seo: {
        title: `${titulo} | Precos e versoes`,
        description: `Consulte precos FIPE de todas as versoes ${marcaNome} ${modSlug}. ${links.length} veiculos indexados.`,
        h1: titulo,
        canonical: `${SITE_URL}${canonicalPath}`,
      },
      veiculos: links.slice(0, 120),
      stats: {
        total: links.length,
        precoMin: valores.length ? Math.min(...valores) : undefined,
        precoMax: valores.length ? Math.max(...valores) : undefined,
        anos: [...new Set(links.map((l) => l.ano))].sort((a, b) => b - a).slice(0, 30),
      },
    };
    const outDir = path.join(PATHS.hubBundlesRoot, 'familia', mSlug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${modSlug}.json`), JSON.stringify(hub, null, 2), 'utf-8');
    manifest.familia++;
  }

  const byEngine = new Map<string, string[]>();
  for (const [vid, eg] of Object.entries(engineGraph)) {
    if (!eg?.engine_id) continue;
    const list = byEngine.get(eg.engine_id) ?? [];
    list.push(vid);
    byEngine.set(eg.engine_id, list);
  }
  fs.mkdirSync(path.join(PATHS.hubBundlesRoot, 'motor'), { recursive: true });
  const engineMaster = fs.existsSync(PATHS.engineMaster)
    ? loadJson<{ entities: Array<{ id: string; nome?: string }> }>(PATHS.engineMaster).entities ?? []
    : [];
  const engineNames = new Map(engineMaster.map((e) => [e.id, e.nome ?? e.id]));

  for (const [engineId, ids] of byEngine) {
    const links: RelatedLink[] = [];
    for (const id of ids) {
      const v = vehById.get(id);
      const u = urlMap[id];
      if (!v || !u) continue;
      links.push(buildHubVeiculo(id, v, u));
    }
    if (links.length < 2) continue;
    const canonicalPath = `/motor/${engineId}/`;
    const nome = engineNames.get(engineId) ?? engineId;
    const hub = {
      tipo: 'motor' as const,
      slug: engineId,
      canonicalPath,
      titulo: `Motor ${nome}`,
      descricao: `${links.length} veiculos com motor ${nome} na Tabela FIPE.`,
      seo: {
        title: `Motor ${nome} - Veiculos e precos FIPE`,
        description: `Veiculos equipados com ${nome}. Specs e precos FIPE.`,
        h1: `Motor ${nome}`,
        canonical: `${SITE_URL}${canonicalPath}`,
      },
      veiculos: links.slice(0, 80),
      stats: { total: links.length },
      meta: { engineId, engineNome: nome },
    };
    fs.writeFileSync(path.join(PATHS.hubBundlesRoot, 'motor', `${engineId}.json`), JSON.stringify(hub, null, 2), 'utf-8');
    manifest.motor++;
  }

  const byPlatform = new Map<string, string[]>();
  for (const [vid, pg] of Object.entries(platformGraph)) {
    if (!pg?.platform_id) continue;
    const list = byPlatform.get(pg.platform_id) ?? [];
    list.push(vid);
    byPlatform.set(pg.platform_id, list);
  }
  fs.mkdirSync(path.join(PATHS.hubBundlesRoot, 'plataforma'), { recursive: true });
  for (const [platformId, ids] of byPlatform) {
    const links: RelatedLink[] = [];
    for (const id of ids) {
      const v = vehById.get(id);
      const u = urlMap[id];
      if (!v || !u) continue;
      links.push(buildHubVeiculo(id, v, u));
    }
    if (links.length < 2) continue;
    const canonicalPath = `/plataforma/${platformId}/`;
    const hub = {
      tipo: 'plataforma' as const,
      slug: platformId,
      canonicalPath,
      titulo: `Plataforma ${platformId}`,
      descricao: `${links.length} veiculos na plataforma ${platformId}.`,
      seo: {
        title: `Plataforma ${platformId} - Veiculos FIPE`,
        description: `Veiculos baseados na plataforma ${platformId}.`,
        h1: `Plataforma ${platformId}`,
        canonical: `${SITE_URL}${canonicalPath}`,
      },
      veiculos: links.slice(0, 80),
      stats: { total: links.length },
      meta: { platformId },
    };
    fs.writeFileSync(
      path.join(PATHS.hubBundlesRoot, 'plataforma', `${platformId}.json`),
      JSON.stringify(hub, null, 2),
      'utf-8',
    );
    manifest.plataforma++;
  }

  fs.mkdirSync(path.join(PATHS.hubBundlesRoot, 'geracao'), { recursive: true });
  const byGen = new Map<string, string[]>();
  for (const [vid, rel] of Object.entries(relations)) {
    if (!rel.geracao_id) continue;
    const list = byGen.get(rel.geracao_id) ?? [];
    list.push(vid);
    byGen.set(rel.geracao_id, list);
  }
  for (const [genId, ids] of byGen) {
    const links: RelatedLink[] = [];
    for (const id of ids) {
      const v = vehById.get(id);
      const u = urlMap[id];
      if (!v || !u) continue;
      links.push(buildHubVeiculo(id, v, u));
    }
    if (links.length < 2) continue;
    const mSlug = marcaSlug(links[0].marca);
    const genSlug = genId.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const canonicalPath = `/geracao/${mSlug}/${genSlug}/`;
    const hub = {
      tipo: 'geracao' as const,
      slug: genSlug,
      canonicalPath,
      titulo: `Geracao ${genId}`,
      descricao: `${links.length} veiculos da geracao ${genId}.`,
      seo: {
        title: `Geracao ${genId} - Precos FIPE`,
        description: `Veiculos da geracao ${genId} na Tabela FIPE.`,
        h1: `Geracao ${genId}`,
        canonical: `${SITE_URL}${canonicalPath}`,
      },
      veiculos: links.slice(0, 80),
      stats: { total: links.length },
      meta: { geracaoId: genId },
    };
    const outDir = path.join(PATHS.hubBundlesRoot, 'geracao', mSlug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${genSlug}.json`), JSON.stringify(hub, null, 2), 'utf-8');
    manifest.geracao++;
  }

  fs.writeFileSync(
    PATHS.hubManifest,
    JSON.stringify({ geradoEm: new Date().toISOString(), ...manifest }, null, 2),
    'utf-8',
  );
  console.log(JSON.stringify(manifest));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
