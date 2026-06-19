/**
 * Importacao integral do catalogo FIPE - apenas para atualizador offline.
 * Producao nunca chama API.
 */

import fs from 'fs';
import path from 'path';
import {
  FipeTipo,
  getAnos,
  getMarcas,
  getModelos,
  getPreco,
  parseValorFipe,
  verificarApiDisponivel,
} from './lib/fipe-client.js';
import { PATHS } from './lib/fipe-paths.js';
import { marcaSlug, veiculoId } from './lib/fipe-slug.js';
import { writeVehicleJson } from './lib/vehicle-paths.js';

const TIPOS: { id: FipeTipo; label: string }[] = [
  { id: 'carros', label: 'Carros' },
  { id: 'motos', label: 'Motos' },
  { id: 'caminhoes', label: 'Caminhoes' },
];

export interface MarcaRecord {
  tipo: FipeTipo;
  codigo: string;
  nome: string;
  slug: string;
}

export interface ModeloRecord {
  tipo: FipeTipo;
  marcaCodigo: string;
  marca: string;
  marcaSlug: string;
  codigo: string;
  nome: string;
}

export interface VeiculoRecord {
  id: string;
  slug: string;
  tipo: FipeTipo;
  marca: string;
  marcaCodigo: string;
  marcaSlug: string;
  modelo: string;
  modeloCodigo: string;
  ano: number;
  anoCodigo: string;
  anoNome: string;
  combustivel?: string;
  fipeCodigo?: string;
  valor?: number;
  mesReferencia?: string;
  dataPath?: string;
}

interface Checkpoint {
  catalogoCompleto: boolean;
  marcasProcessadas: Partial<Record<FipeTipo, string[]>>;
  precosProcessados: string[];
  stats: { marcas: number; modelos: number; veiculos: number; comPreco: number };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, def: string) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  return {
    fase: get('--fase', 'tudo') as 'catalogo' | 'precos' | 'tudo',
    tipo: get('--tipo', 'all') as FipeTipo | 'all',
  };
}

function ensureDirs() {
  for (const d of [
    path.dirname(PATHS.checkpoint),
    path.dirname(PATHS.srcMarcas),
    PATHS.publicDataRoot,
    PATHS.publicSearchDir,
  ]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function loadJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

function saveJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

function loadCheckpoint(): Checkpoint {
  return loadJson<Checkpoint>(PATHS.checkpoint, {
    catalogoCompleto: false,
    marcasProcessadas: {},
    precosProcessados: [],
    stats: { marcas: 0, modelos: 0, veiculos: 0, comPreco: 0 },
  });
}

function saveCheckpoint(cp: Checkpoint) {
  saveJson(PATHS.checkpoint, cp);
}

function extrairAno(anoNome: string, anoCodigo: string): number {
  const match = String(anoNome).match(/\d{4}/);
  if (match) return parseInt(match[0], 10);
  const fromCodigo = parseInt(String(anoCodigo).split('-')[0], 10);
  return isNaN(fromCodigo) ? 0 : fromCodigo;
}

function persistCatalogo(marcas: MarcaRecord[], modelos: ModeloRecord[], veiculos: VeiculoRecord[]) {
  for (const [file, data] of [
    [PATHS.srcMarcas, marcas],
    [PATHS.srcModelos, modelos],
    [PATHS.srcVeiculos, veiculos],
    [PATHS.publicMarcas, marcas],
    [PATHS.publicModelos, modelos],
  ] as const) {
    saveJson(file, data);
  }
}

function mergeByFipeCodigo(veiculos: VeiculoRecord[]): VeiculoRecord[] {
  const map = new Map<string, VeiculoRecord>();
  for (const v of veiculos) {
    const key = v.fipeCodigo || v.id;
    const prev = map.get(key);
    if (!prev || (v.valor || 0) >= (prev.valor || 0)) map.set(key, v);
  }
  return [...map.values()];
}

async function faseCatalogo(opts: { tipo: FipeTipo | 'all' }) {
  const cp = loadCheckpoint();
  let marcas = loadJson<MarcaRecord[]>(PATHS.srcMarcas, []);
  let modelos = loadJson<ModeloRecord[]>(PATHS.srcModelos, []);
  let veiculos = loadJson<VeiculoRecord[]>(PATHS.srcVeiculos, []);

  if (cp.catalogoCompleto) {
    console.log('Catalogo ja completo - pulando fase catalogo');
    return { marcas, modelos, veiculos };
  }

  const tipos = opts.tipo === 'all' ? TIPOS : TIPOS.filter((t) => t.id === opts.tipo);

  for (const tipo of tipos) {
    console.log(`\n=== ${tipo.label.toUpperCase()} ===`);
    const marcasApi = await getMarcas(tipo.id);
    console.log(`Marcas na API: ${marcasApi.length}`);

    if (!cp.marcasProcessadas[tipo.id]) cp.marcasProcessadas[tipo.id] = [];
    const processadas = new Set(cp.marcasProcessadas[tipo.id]);

    for (let mi = 0; mi < marcasApi.length; mi++) {
      const marca = marcasApi[mi];
      if (processadas.has(marca.codigo)) {
        console.log(`[${mi + 1}/${marcasApi.length}] ${marca.nome} - ja importada`);
        continue;
      }

      console.log(`[${mi + 1}/${marcasApi.length}] ${marca.nome}`);
      const mSlug = marcaSlug(marca.nome);

      if (!marcas.find((m) => m.tipo === tipo.id && m.codigo === marca.codigo)) {
        marcas.push({ tipo: tipo.id, codigo: marca.codigo, nome: marca.nome, slug: mSlug });
      }

      const modelosApi = await getModelos(tipo.id, marca.codigo);
      if (!modelosApi.length) {
        processadas.add(marca.codigo);
        cp.marcasProcessadas[tipo.id] = [...processadas];
        cp.stats = {
          marcas: marcas.length,
          modelos: modelos.length,
          veiculos: veiculos.length,
          comPreco: cp.stats.comPreco,
        };
        saveCheckpoint(cp);
        persistCatalogo(marcas, modelos, veiculos);
        continue;
      }

      for (const modelo of modelosApi) {
        if (
          !modelos.find(
            (m) => m.tipo === tipo.id && m.codigo === modelo.codigo && m.marcaCodigo === marca.codigo,
          )
        ) {
          modelos.push({
            tipo: tipo.id,
            marcaCodigo: marca.codigo,
            marca: marca.nome,
            marcaSlug: mSlug,
            codigo: modelo.codigo,
            nome: modelo.nome,
          });
        }

        const anosApi = await getAnos(tipo.id, marca.codigo, modelo.codigo);
        for (const ano of anosApi) {
          const anoNum = extrairAno(ano.nome, ano.codigo);
          const id = veiculoId(marca.nome, modelo.nome, anoNum || ano.codigo);
          if (veiculos.some((v) => v.id === id)) continue;

          veiculos.push({
            id,
            slug: id,
            tipo: tipo.id,
            marca: marca.nome,
            marcaCodigo: marca.codigo,
            marcaSlug: mSlug,
            modelo: modelo.nome,
            modeloCodigo: modelo.codigo,
            ano: anoNum,
            anoCodigo: ano.codigo,
            anoNome: ano.nome,
          });
        }
      }

      processadas.add(marca.codigo);
      cp.marcasProcessadas[tipo.id] = [...processadas];
      cp.stats = {
        marcas: marcas.length,
        modelos: modelos.length,
        veiculos: veiculos.length,
        comPreco: cp.stats.comPreco,
      };
      saveCheckpoint(cp);
      persistCatalogo(marcas, modelos, veiculos);
    }
  }

  cp.catalogoCompleto = true;
  veiculos = mergeByFipeCodigo(veiculos);
  cp.stats = {
    marcas: marcas.length,
    modelos: modelos.length,
    veiculos: veiculos.length,
    comPreco: cp.stats.comPreco,
  };
  saveCheckpoint(cp);
  persistCatalogo(marcas, modelos, veiculos);

  console.log(`\nCatalogo: ${marcas.length} marcas, ${modelos.length} modelos, ${veiculos.length} veiculos`);
  return { marcas, modelos, veiculos };
}

async function fasePrecos() {
  const cp = loadCheckpoint();
  let veiculos = loadJson<VeiculoRecord[]>(PATHS.srcVeiculos, []);
  if (!veiculos.length) throw new Error('Execute --fase catalogo primeiro.');

  const processados = new Set(cp.precosProcessados);
  const pendentes = veiculos.filter((v) => !processados.has(v.id));
  console.log(`\nPrecos pendentes: ${pendentes.length} / ${veiculos.length}`);

  let ok = 0;
  let erros = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const v = pendentes[i];
    try {
      const detalhe = await getPreco(v.tipo, v.marcaCodigo, v.modeloCodigo, v.anoCodigo);
      const valor = parseValorFipe(detalhe.Valor);
      if (valor <= 0) {
        erros++;
        continue;
      }

      v.combustivel = detalhe.Combustivel;
      v.fipeCodigo = detalhe.CodigoFipe;
      v.valor = valor;
      v.mesReferencia = detalhe.MesReferencia;

      const anoModelo = parseInt(String(detalhe.AnoModelo), 10) || v.ano;
      const payload = {
        id: v.id,
        slug: v.slug,
        codigoFipe: detalhe.CodigoFipe,
        marca: detalhe.Marca,
        modelo: detalhe.Modelo,
        ano: anoModelo,
        anoModelo,
        combustivel: detalhe.Combustivel,
        valor,
        valorFormatado: detalhe.Valor,
        mesReferencia: detalhe.MesReferencia,
        tipo: v.tipo,
        nome: `${detalhe.Marca} ${detalhe.Modelo} (${detalhe.AnoModelo})`,
        historicoPrecos: [{ mes: detalhe.MesReferencia || 'Jun/2026', valor }],
      };

      const { publicPath } = writeVehicleJson(
        {
          marca: detalhe.Marca,
          modelo: detalhe.Modelo,
          ano: payload.anoModelo,
          combustivel: detalhe.Combustivel,
          fipeCodigo: detalhe.CodigoFipe,
        },
        payload,
      );
      v.dataPath = publicPath;

      const idx = veiculos.findIndex((x) => x.id === v.id);
      if (idx >= 0) veiculos[idx] = v;

      processados.add(v.id);
      ok++;

      if (ok % 25 === 0) {
        cp.precosProcessados = [...processados];
        cp.stats.comPreco = processados.size;
        saveCheckpoint(cp);
        veiculos = mergeByFipeCodigo(veiculos);
        saveJson(PATHS.srcVeiculos, veiculos);
        console.log(`  [${i + 1}/${pendentes.length}] ${ok} precos importados`);
      }
    } catch (err) {
      erros++;
      const msg = String((err as Error).message);
      if (msg.includes('429') || msg.includes('Rate limit')) {
        console.warn('Rate limit - retome com: npm run catalog:prices');
        break;
      }
    }
  }

  cp.precosProcessados = [...processados];
  cp.stats.comPreco = processados.size;
  saveCheckpoint(cp);
  veiculos = mergeByFipeCodigo(veiculos);
  saveJson(PATHS.srcVeiculos, veiculos);
  console.log(`\nPrecos: ${ok} nesta execucao | Erros: ${erros} | Total: ${processados.size}`);
}

function gerarRelatorio(cp: Checkpoint) {
  const marcas = loadJson<MarcaRecord[]>(PATHS.srcMarcas, []);
  const modelos = loadJson<ModeloRecord[]>(PATHS.srcModelos, []);
  const veiculos = loadJson<VeiculoRecord[]>(PATHS.srcVeiculos, []);

  const marcasPorTipo = TIPOS.map((t) => ({
    tipo: t.id,
    marcas: marcas.filter((m) => m.tipo === t.id).length,
    modelos: modelos.filter((m) => m.tipo === t.tipo).length,
    veiculos: veiculos.filter((v) => v.tipo === t.tipo).length,
  }));

  const totalMarcasApi = marcasPorTipo.reduce((s, t) => s + t.marcas, 0);
  const processadas = Object.values(cp.marcasProcessadas).flat().length;
  const coberturaEstimada = cp.catalogoCompleto
    ? '100% - catalogo percorrido integralmente'
    : `${totalMarcasApi ? Math.round((processadas / totalMarcasApi) * 100) : 0}% - importacao em andamento`;

  const relatorio = {
    geradoEm: new Date().toISOString(),
    fonte: 'parallelum.com.br/fipe/api/v1 (fallback: brasilapi.com.br)',
    armazenamento: 'public/data/fipe/{marca}/{modelo}/{ano}.json',
    totais: {
      marcas: marcas.length,
      modelos: modelos.length,
      veiculos: veiculos.length,
      comPreco: cp.stats.comPreco,
      pendentesPreco: veiculos.length - cp.stats.comPreco,
    },
    porTipo: marcasPorTipo,
    coberturaEstimada,
    catalogoCompleto: cp.catalogoCompleto,
  };

  saveJson(PATHS.relatorio, relatorio);
  return relatorio;
}

async function main() {
  const opts = parseArgs();
  console.log('=== Importacao FIPE (atualizador offline) ===');
  console.log(`Fase: ${opts.fase} | Tipo: ${opts.tipo}`);

  ensureDirs();
  await verificarApiDisponivel();

  if (opts.fase === 'catalogo' || opts.fase === 'tudo') await faseCatalogo(opts);
  if (opts.fase === 'precos' || opts.fase === 'tudo') await fasePrecos();

  const rel = gerarRelatorio(loadCheckpoint());

  console.log('\n========== RELATORIO ==========');
  console.log(`Marcas importadas:    ${rel.totais.marcas}`);
  console.log(`Modelos importados:   ${rel.totais.modelos}`);
  console.log(`Registros gerados:    ${rel.totais.veiculos}`);
  console.log(`Com preco FIPE:       ${rel.totais.comPreco}`);
  console.log(`Cobertura estimada:   ${rel.coberturaEstimada}`);
}

main().catch((err) => {
  console.error('Falha fatal:', err);
  process.exit(1);
});
