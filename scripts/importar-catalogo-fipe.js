/**
 * Importador completo do catálogo FIPE
 *
 * Fases:
 *   arvore  — marcas, modelos (versões FIPE), anos (sem preços)
 *   precos  — busca preço de cada folha e gera JSON + índice de busca
 *   tudo    — arvore + precos
 *
 * Uso:
 *   node scripts/importar-catalogo-fipe.js --fase arvore
 *   node scripts/importar-catalogo-fipe.js --fase precos
 *   node scripts/importar-catalogo-fipe.js --fase tudo
 *   node scripts/importar-catalogo-fipe.js --fase precos --limite 500
 *
 * Variáveis de ambiente (opcional):
 *   FIPE_API_TOKEN — token gratuito fipe.online (1000 req/dia)
 *   FIPE_DELAY_MS  — delay entre requisições (default 350)
 */

import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const API_V1 = 'https://parallelum.com.br/fipe/api/v1';
const API_V2 = 'https://fipe.parallelum.com.br/api/v2';

const TIPOS = [
  { id: 'carros', apiV1: 'carros', apiV2: 'cars', label: 'Carros' },
  { id: 'motos', apiV1: 'motos', apiV2: 'motorcycles', label: 'Motos' },
  { id: 'caminhoes', apiV1: 'caminhoes', apiV2: 'trucks', label: 'Caminhões' },
];

const ROOT = process.cwd();
const CATALOG_DIR = path.join(ROOT, 'data', 'catalog');
const CHECKPOINT_FILE = path.join(CATALOG_DIR, 'checkpoint.json');
const TREE_FILE = path.join(CATALOG_DIR, 'tree.json');
const RELATORIO_FILE = path.join(CATALOG_DIR, 'relatorio.json');
const HISTORICO_DIR = path.join(ROOT, 'public', 'api', 'historico');
const BUSCA_FILE = path.join(ROOT, 'public', 'api', 'busca-rapida.json');
const SEARCH_SHARDS_DIR = path.join(ROOT, 'public', 'api', 'search');

const DELAY_MS = parseInt(process.env.FIPE_DELAY_MS || '500', 10);
const TOKEN = process.env.FIPE_API_TOKEN || '';

const MODELOS_MULTI_PALAVRA = [
  'corolla cross', 'corolla fielder', 'hb20', 'hb20s', 'hr-v', 'hrv', 'cg 160', 'cg 150',
  'cg 125', 'biz 125', 'land rover', 'grand cherokee', 'santa fe', 'eco sport', 'ecosport',
  'gol gti', 'gol rallye', 'uno mille', 'palio weekend', 'civic type', 'fit twist',
];

const MARCAS_SINONIMOS = {
  chevrolet: 'gm chevrolet general motors',
  volkswagen: 'volkswagen vw',
  fiat: 'fiat',
  honda: 'honda',
  toyota: 'toyota',
  ford: 'ford',
  hyundai: 'hyundai',
  renault: 'renault',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag, def) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  return {
    fase: get('--fase', 'tudo'),
    limite: parseInt(get('--limite', '0'), 10),
    tipo: get('--tipo', 'all'),
  };
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function marcaSlug(marca) {
  const l = marca.toLowerCase();
  if (l.includes('chevrolet') || l.includes('gm')) return 'chevrolet';
  if (l.includes('volkswagen') || l.includes('vw')) return 'volkswagen';
  return slugify(marca.replace(/^(gm\s*-\s*|vw\s*-\s*)/i, ''));
}

function extrairModeloBase(nomeVersao) {
  const lower = nomeVersao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const m of MODELOS_MULTI_PALAVRA) {
    if (lower.includes(m)) return m.replace(/\s+/g, '-');
  }
  const cleaned = lower.replace(/\s+\d[\d.,].*$/, '').trim();
  const first = cleaned.split(/\s+/)[0] || 'geral';
  return slugify(first);
}

function parseValorFipe(valorStr) {
  if (!valorStr) return 0;
  const clean = String(valorStr).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n);
}

function gerarTermoBusca(marca, modelo, combustivel, ano, tipo) {
  const ms = marcaSlug(marca);
  let base = `${ms} ${modelo} ${combustivel} ${ano}`.toLowerCase();
  const syn = MARCAS_SINONIMOS[ms];
  if (syn) base += ` ${syn}`;
  if (tipo === 'motos') base += ' moto motocicleta';
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_FILE)) {
    return {
      arvoreCompleta: false,
      arvoreMarcasProcessadas: {},
      precosProcessados: [],
      stats: {},
    };
  }
  const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  if (!cp.arvoreMarcasProcessadas) cp.arvoreMarcasProcessadas = {};
  return cp;
}

function saveCheckpoint(cp) {
  fs.mkdirSync(CATALOG_DIR, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

async function fetchApi(url) {
  const headers = { Accept: 'application/json' };
  if (TOKEN) headers['X-Subscription-Token'] = TOKEN;

  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        const wait = DELAY_MS * 12 * attempt;
        console.warn(`[429] Rate limit — pausa ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 8) throw err;
      await sleep(DELAY_MS * 4 * attempt);
    }
  }
  throw new Error(`Falha após retentativas: ${url}`);
}

async function fetchV1(endpoint) {
  await sleep(DELAY_MS);
  return fetchApi(`${API_V1}/${endpoint}`);
}

async function verificarApiDisponivel() {
  try {
    const res = await fetch(`${API_V1}/carros/marcas`, {
      headers: TOKEN ? { 'X-Subscription-Token': TOKEN } : {},
    });
    if (res.status === 429) {
      console.error('\n❌ API FIPE bloqueada (429) — cota diária esgotada.');
      console.error('   Opções:');
      console.error('   1. Aguardar reset (24h) e executar: npm run catalog:tree');
      console.error('   2. Registrar token gratuito em https://fipe.online/register');
      console.error('      e definir FIPE_API_TOKEN no arquivo .env (1000 req/dia)');
      process.exit(1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (err) {
    console.error('API indisponível:', err.message);
    process.exit(1);
  }
}

function ensureDirs() {
  [CATALOG_DIR, HISTORICO_DIR, SEARCH_SHARDS_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function contarStats(tree) {
  let totalMarcas = 0;
  let totalModelosBase = 0;
  let totalVersoes = 0;
  for (const tipo of Object.values(tree.tipos || {})) {
    const marcas = Object.values(tipo.marcas || {});
    totalMarcas += marcas.length;
    for (const marca of marcas) {
      const modelos = Object.values(marca.modelos || {});
      totalModelosBase += modelos.length;
      for (const modelo of modelos) {
        totalVersoes += Object.keys(modelo.versoes || {}).length;
      }
    }
  }
  return {
    marcas: totalMarcas,
    modelosBase: totalModelosBase,
    versoes: totalVersoes,
    folhas: tree.folhas?.length || 0,
  };
}

function salvarArvoreParcial(tree, cp) {
  tree.meta.stats = contarStats(tree);
  fs.writeFileSync(TREE_FILE, JSON.stringify(tree));
  cp.stats = tree.meta.stats;
  saveCheckpoint(cp);
}

/**
 * FASE 1: Construir árvore completa marca → modelo-base → versão → anos
 * Suporta retomada via checkpoint (marca a marca).
 */
async function faseArvore(opts) {
  ensureDirs();
  const cp = loadCheckpoint();

  let tree;
  if (!cp.arvoreCompleta && fs.existsSync(TREE_FILE)) {
    tree = JSON.parse(fs.readFileSync(TREE_FILE, 'utf-8'));
    console.log(`Retomando árvore parcial (${tree.folhas?.length || 0} folhas já coletadas)`);
  } else if (cp.arvoreCompleta && fs.existsSync(TREE_FILE)) {
    console.log('Árvore já completa — pulando fase arvore');
    return JSON.parse(fs.readFileSync(TREE_FILE, 'utf-8'));
  } else {
    tree = {
      meta: { geradoEm: new Date().toISOString(), referencia: null },
      tipos: {},
      folhas: [],
    };
  }

  if (!cp.arvoreMarcasProcessadas) cp.arvoreMarcasProcessadas = {};

  const tiposFiltrados = opts.tipo === 'all' ? TIPOS : TIPOS.filter((t) => t.id === opts.tipo);

  for (const tipo of tiposFiltrados) {
    console.log(`\n=== ${tipo.label.toUpperCase()} ===`);
    const marcas = await fetchV1(`${tipo.apiV1}/marcas`);
    console.log(`Marcas: ${marcas.length}`);

    if (!tree.tipos[tipo.id]) {
      tree.tipos[tipo.id] = { label: tipo.label, marcas: {} };
    }
    if (!cp.arvoreMarcasProcessadas[tipo.id]) {
      cp.arvoreMarcasProcessadas[tipo.id] = [];
    }
    const processadas = new Set(cp.arvoreMarcasProcessadas[tipo.id]);

    for (let mi = 0; mi < marcas.length; mi++) {
      const marca = marcas[mi];
      if (processadas.has(marca.codigo)) {
        console.log(`[${mi + 1}/${marcas.length}] ${marca.nome} — já importada`);
        continue;
      }

      const mSlug = marcaSlug(marca.nome);
      console.log(`[${mi + 1}/${marcas.length}] ${marca.nome}`);

      if (!tree.tipos[tipo.id].marcas[mSlug]) {
        tree.tipos[tipo.id].marcas[mSlug] = {
          nome: marca.nome,
          codigo: marca.codigo,
          modelos: {},
        };
      }

      const modelosData = await fetchV1(`${tipo.apiV1}/marcas/${marca.codigo}/modelos`);
      const modelos = Array.isArray(modelosData)
        ? modelosData
        : modelosData?.modelos || [];
      if (!modelos.length) {
        console.warn(`  Sem modelos para ${marca.nome} — pulando`);
        processadas.add(marca.codigo);
        cp.arvoreMarcasProcessadas[tipo.id] = [...processadas];
        salvarArvoreParcial(tree, cp);
        continue;
      }

      const marcaNode = tree.tipos[tipo.id].marcas[mSlug];
      if (!marcaNode?.modelos) {
        tree.tipos[tipo.id].marcas[mSlug] = {
          nome: marca.nome,
          codigo: marca.codigo,
          modelos: {},
        };
      }

      for (const modelo of modelos) {
        const modeloBaseSlug = extrairModeloBase(modelo.nome);
        const versaoSlug = slugify(modelo.nome);

        if (!tree.tipos[tipo.id].marcas[mSlug].modelos[modeloBaseSlug]) {
          tree.tipos[tipo.id].marcas[mSlug].modelos[modeloBaseSlug] = {
            nome: modeloBaseSlug.replace(/-/g, ' '),
            versoes: {},
          };
        }

        const anos = await fetchV1(
          `${tipo.apiV1}/marcas/${marca.codigo}/modelos/${modelo.codigo}/anos`,
        );

        const anosLista = (anos || []).map((a) => ({
          codigo: a.codigo,
          nome: a.nome,
          ano: parseInt(String(a.nome).match(/\d{4}/)?.[0] || a.codigo, 10),
        }));

        tree.tipos[tipo.id].marcas[mSlug].modelos[modeloBaseSlug].versoes[versaoSlug] = {
          nome: modelo.nome,
          codigoModelo: modelo.codigo,
          anos: anosLista,
        };

        for (const ano of anosLista) {
          const folhaId = `${mSlug}-${versaoSlug}-${ano.ano || slugify(ano.codigo)}`;
          if (tree.folhas.some((f) => f.id === folhaId)) continue;
          tree.folhas.push({
            id: folhaId,
            tipo: tipo.id,
            marca: marca.nome,
            marcaSlug: mSlug,
            marcaCodigo: marca.codigo,
            modeloBase: modeloBaseSlug,
            versao: modelo.nome,
            versaoSlug,
            modeloCodigo: modelo.codigo,
            anoCodigo: ano.codigo,
            ano: ano.ano,
          });
        }
      }

      processadas.add(marca.codigo);
      cp.arvoreMarcasProcessadas[tipo.id] = [...processadas];
      salvarArvoreParcial(tree, cp);
    }
  }

  tree.meta.stats = contarStats(tree);
  cp.arvoreCompleta = true;
  cp.stats = tree.meta.stats;
  saveCheckpoint(cp);
  fs.writeFileSync(TREE_FILE, JSON.stringify(tree));

  const busca = fs.existsSync(BUSCA_FILE)
    ? JSON.parse(fs.readFileSync(BUSCA_FILE, 'utf-8'))
    : [];
  gerarRelatorio(tree, busca, cp);

  console.log(`\nÁrvore salva: ${TREE_FILE}`);
  console.log(`Folhas (veículos pesquisáveis potenciais): ${tree.meta.stats.folhas}`);
  console.log(`Marcas: ${tree.meta.stats.marcas} | Modelos-base: ${tree.meta.stats.modelosBase} | Versões: ${tree.meta.stats.versoes}`);

  return tree;
}

function obterConsumoEstimado(nome) {
  const l = nome.toLowerCase();
  if (l.includes('diesel') || l.includes('4x4')) return { cidadeG: 11.2, cidadeE: 11.2, estradaG: 14.5, estradaE: 14.5 };
  if (l.includes('1.0')) return { cidadeG: 13.3, cidadeE: 9.3, estradaG: 14.9, estradaE: 10.5 };
  if (l.includes('2.0')) return { cidadeG: 9.9, cidadeE: 6.9, estradaG: 12.2, estradaE: 8.5 };
  return { cidadeG: 11.2, cidadeE: 7.8, estradaG: 12.9, estradaE: 9.1 };
}

function categoriaPecas(marca, valor) {
  const m = marca.toLowerCase();
  if (valor > 150000) return 'alta';
  if (/bmw|mercedes|audi|porsche|volvo|land rover/i.test(m)) return 'alta';
  if (/toyota|honda|nissan|jeep|mitsubishi/i.test(m)) return 'media';
  return 'baixa';
}

function historicoPlaceholder(valorAtual) {
  const meses = ['Jan/26', 'Fev/26', 'Mar/26', 'Abr/26', 'Mai/26', 'Jun/26'];
  return meses.map((mes) => ({ mes, valor: valorAtual }));
}

/**
 * FASE 2: Buscar preços e gerar shards + índice
 */
async function fasePrecos(opts) {
  ensureDirs();
  if (!fs.existsSync(TREE_FILE)) {
    throw new Error('Execute --fase arvore primeiro.');
  }

  const tree = JSON.parse(fs.readFileSync(TREE_FILE, 'utf-8'));
  const cp = loadCheckpoint();
  const processados = new Set(cp.precosProcessados || []);

  let folhas = tree.folhas;
  if (opts.tipo !== 'all') folhas = folhas.filter((f) => f.tipo === opts.tipo);
  if (opts.limite > 0) folhas = folhas.slice(0, opts.limite);

  const pendentes = folhas.filter((f) => !processados.has(f.id));
  console.log(`\nFolhas pendentes: ${pendentes.length} / ${folhas.length}`);

  const indice = [];
  const existingIndex = fs.existsSync(BUSCA_FILE)
    ? JSON.parse(fs.readFileSync(BUSCA_FILE, 'utf-8'))
    : [];
  const indexMap = new Map(existingIndex.map((i) => [i.id, i]));

  let ok = 0;
  let erros = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const folha = pendentes[i];
    const tipoApi = TIPOS.find((t) => t.id === folha.tipo)?.apiV1;
    if (!tipoApi) continue;

    try {
      const detalhe = await fetchV1(
        `${tipoApi}/marcas/${folha.marcaCodigo}/modelos/${folha.modeloCodigo}/anos/${folha.anoCodigo}`,
      );

      const valor = parseValorFipe(detalhe.Valor);
      if (valor <= 0) {
        erros++;
        continue;
      }

      const vehicle = {
        id: folha.id,
        nome: `${detalhe.Marca} ${detalhe.Modelo} (${detalhe.AnoModelo})`,
        marca: detalhe.Marca,
        modelo: detalhe.Modelo,
        modeloBase: folha.modeloBase,
        versaoSlug: folha.versaoSlug,
        anoModelo: parseInt(detalhe.AnoModelo, 10) || folha.ano,
        fipeCodigo: detalhe.CodigoFipe,
        combustivel: detalhe.Combustivel,
        valorAtual: valor,
        tipo: folha.tipo,
        categoriaPecas: categoriaPecas(detalhe.Marca, valor),
        consumo: obterConsumoEstimado(detalhe.Modelo),
        historicoPrecos: historicoPlaceholder(valor),
        mesReferencia: detalhe.MesReferencia || 'Jun/2026',
      };

      fs.writeFileSync(
        path.join(HISTORICO_DIR, `${folha.id}.json`),
        JSON.stringify(vehicle),
      );

      const item = {
        id: folha.id,
        termoBusca: gerarTermoBusca(
          detalhe.Marca,
          detalhe.Modelo,
          detalhe.Combustivel,
          detalhe.AnoModelo,
          folha.tipo,
        ),
        nome: vehicle.nome,
        valor,
        marca: detalhe.Marca,
        ano: vehicle.anoModelo,
        combustivel: detalhe.Combustivel,
        tipo: folha.tipo,
        searchText: `${detalhe.Marca} ${detalhe.Modelo} ${detalhe.AnoModelo}`.toLowerCase(),
      };

      indexMap.set(folha.id, item);
      processados.add(folha.id);
      ok++;

      if (ok % 25 === 0) {
        cp.precosProcessados = [...processados];
        saveCheckpoint(cp);
        console.log(`  [${i + 1}/${pendentes.length}] ${ok} importados — último: ${vehicle.nome}`);
      }
    } catch (err) {
      erros++;
      console.warn(`  Erro ${folha.id}: ${err.message}`);
      if (String(err.message).includes('429')) {
        console.warn('Rate limit — checkpoint salvo. Execute novamente amanhã.');
        break;
      }
    }
  }

  cp.precosProcessados = [...processados];
  saveCheckpoint(cp);

  const finalIndex = [...indexMap.values()];
  fs.writeFileSync(BUSCA_FILE, JSON.stringify(finalIndex));

  gerarShardsBusca(finalIndex);
  gerarRelatorio(tree, finalIndex, cp);

  console.log(`\nImportados nesta execução: ${ok} | Erros: ${erros}`);
  console.log(`Índice total: ${finalIndex.length} veículos`);
  return finalIndex;
}

function gerarShardsBusca(indice) {
  const shards = {};
  for (const item of indice) {
    const first = (item.termoBusca[0] || '0').toLowerCase();
    const key = /[a-z]/.test(first) ? first : '0';
    if (!shards[key]) shards[key] = [];
    shards[key].push({
      i: item.id,
      n: item.nome,
      m: marcaSlug(item.marca || ''),
      a: item.ano,
      v: item.valor,
      t: item.tipo || 'carros',
      c: item.combustivel,
      s: item.termoBusca,
    });
  }

  const manifest = { shards: Object.keys(shards).sort(), total: indice.length };
  fs.writeFileSync(path.join(SEARCH_SHARDS_DIR, 'manifest.json'), JSON.stringify(manifest));
  for (const [key, items] of Object.entries(shards)) {
    fs.writeFileSync(
      path.join(SEARCH_SHARDS_DIR, `shard-${key}.json`),
      JSON.stringify(items),
    );
  }
  console.log(`Shards de busca: ${manifest.shards.length} arquivos, ${manifest.total} itens`);
}

function gerarRelatorio(tree, indice, cp) {
  const verificar = ['opala', 'vectra', 'gol', 'uno', 'palio', 'corsa', 'civic', 'corolla', 'cg 160', 'cg', 'biz'];
  const cobertura = {};
  const folhas = tree.folhas || [];
  for (const termo of verificar) {
    const t = termo.replace(/\s+/g, ' ').toLowerCase();
    const noIndice = indice.filter((i) => i.termoBusca?.includes(t) || i.searchText?.includes(t));
    const naArvore = folhas.filter(
      (f) =>
        f.modeloBase?.includes(t.replace(/\s+/g, '-')) ||
        f.versao?.toLowerCase().includes(t) ||
        f.marca?.toLowerCase().includes(t),
    );
    cobertura[termo] = {
      comPreco: noIndice.length,
      naArvore: naArvore.length,
    };
  }

  const relatorio = {
    geradoEm: new Date().toISOString(),
    arvore: tree.meta?.stats || cp.stats || {},
    veiculosComPreco: indice.length,
    veiculosPesquisaveis: indice.length,
    folhasCatalogo: folhas.length,
    veiculosPendentesPreco: Math.max(0, folhas.length - indice.length),
    coberturaPopulares: cobertura,
    arquivos: {
      tree: TREE_FILE,
      busca: BUSCA_FILE,
      shards: SEARCH_SHARDS_DIR,
      historico: HISTORICO_DIR,
    },
  };

  fs.writeFileSync(RELATORIO_FILE, JSON.stringify(relatorio, null, 2));
  console.log(`\nRelatório: ${RELATORIO_FILE}`);
  return relatorio;
}

async function main() {
  const opts = parseArgs();
  console.log('=== Importador Catálogo FIPE ===');
  console.log(`Fase: ${opts.fase} | Tipo: ${opts.tipo} | Limite: ${opts.limite || 'sem'}`);

  ensureDirs();
  await verificarApiDisponivel();

  if (opts.fase === 'arvore' || opts.fase === 'tudo') {
    await faseArvore(opts);
  }

  if (opts.fase === 'precos' || opts.fase === 'tudo') {
    await fasePrecos(opts);
  }

  if (fs.existsSync(RELATORIO_FILE)) {
    const r = JSON.parse(fs.readFileSync(RELATORIO_FILE, 'utf-8'));
    console.log('\n========== RELATÓRIO ==========');
    console.log(`Marcas:              ${r.arvore.marcas ?? '—'}`);
    console.log(`Modelos (agrupados): ${r.arvore.modelosBase ?? '—'}`);
    console.log(`Versões FIPE:        ${r.arvore.versoes ?? '—'}`);
    console.log(`Folhas (ano/versão): ${r.arvore.folhas ?? '—'}`);
    console.log(`Com preço importado: ${r.veiculosComPreco}`);
    console.log(`Folhas no catálogo:  ${r.folhasCatalogo ?? r.arvore.folhas ?? '—'}`);
    console.log(`Pendentes de preço:  ${r.veiculosPendentesPreco}`);
    if (r.coberturaPopulares) {
      console.log('Cobertura populares (comPreço / naÁrvore):');
      for (const [k, v] of Object.entries(r.coberturaPopulares)) {
        const val = typeof v === 'object' ? `${v.comPreco} / ${v.naArvore}` : v;
        console.log(`  ${k.padEnd(12)} ${val}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Falha fatal:', err);
  process.exit(1);
});
