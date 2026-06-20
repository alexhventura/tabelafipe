import type { SeoModelo } from './seo-data';
import {
  clusterPath,
  compararPath,
  decisaoValeAPenaPath,
  historicoPath,
  intentPath as intentPathRoute,
  modeloPath,
} from './seo-routes';
import type { SemanticIntentSlug } from './seo-routes';

export const INTENTS = [
  'preco',
  'fipe-atualizada',
  'vale-a-pena',
  'comparativo',
  'consumo',
  'manutencao',
  'problemas',
  'seguro',
] as const;

export type SemanticIntent = SemanticIntentSlug;

export const ENRICHMENT_PENDING_INTENTS: SemanticIntent[] = [
  'consumo',
  'manutencao',
  'problemas',
  'seguro',
];

export const MARCA_CLUSTER_TYPES = [
  'confiabilidade',
  'mais-vendidos',
  'problematicos',
  'manutencao',
  'comparacao',
] as const;

export type MarcaClusterType = (typeof MARCA_CLUSTER_TYPES)[number];

export const RESERVED_ROOT_SEGMENTS = new Set([
  'fipe',
  'busca',
  'marca',
  'modelo',
  'historico',
  'comparar',
  'ano',
  'data',
  'api',
]);

export interface ParsedSemanticSlug {
  modeloSlug: string;
  ano: number;
  intent: SemanticIntent;
}

export interface MarcaClusterData {
  slug: string;
  nome: string;
  totalVeiculos: number;
  valorMedio: number | null;
  topModelos: {
    modeloSlug: string;
    modeloNome: string;
    totalVeiculos: number;
    valorMedio: number | null;
  }[];
  modelosAltaDesvalorizacao: {
    modeloSlug: string;
    modeloNome: string;
    desvalorizacaoPercentual: number;
    valorMedio: number | null;
  }[];
  analise: string[];
}

export interface DecisaoValeAPena {
  slug: string;
  url: string;
  marcaSlug: string;
  modeloSlug: string;
  ano: number;
  totalScore: number;
}

export interface DecisaoComparativoOu {
  slug: string;
  url: string;
  segmento: string;
  score?: number;
  a: {
    marcaSlug: string;
    modeloSlug: string;
    marcaNome: string;
    modeloNome: string;
    totalVeiculos: number;
    valorMedio: number;
  };
  b: {
    marcaSlug: string;
    modeloSlug: string;
    marcaNome: string;
    modeloNome: string;
    totalVeiculos: number;
    valorMedio: number;
  };
}

export interface DecisaoMelhoresSegmento {
  slug: string;
  url: string;
  segmento: string;
  ano: number;
  modelos: {
    marcaSlug: string;
    modeloSlug: string;
    modeloNome: string;
    totalScore: number;
    valorMedioAno: number;
  }[];
}

export interface DecisaoIndex {
  valeAPena: DecisaoValeAPena[];
  comparativosOu: DecisaoComparativoOu[];
  melhoresSegmento: DecisaoMelhoresSegmento[];
}

export interface IntentSection {
  heading: string;
  body: string;
}

export interface IntentLink {
  label: string;
  href: string;
}

export interface IntentContent {
  title: string;
  description: string;
  sections: IntentSection[];
  links: IntentLink[];
  faq: { pergunta: string; resposta: string }[];
}

export function anoSlug(ano: number): string {
  return ano === 0 ? 'zero-km' : String(ano);
}

export function intentPath(
  marcaSlug: string,
  modeloSlug: string,
  ano: number,
  intent: SemanticIntent,
): string {
  return intentPathRoute(marcaSlug, modeloSlug, ano, intent);
}

export function parseSemanticSlug(pageSlug: string): ParsedSemanticSlug | null {
  const sortedIntents = [...INTENTS].sort((a, b) => b.length - a.length);
  for (const intent of sortedIntents) {
    const suffix = `-${intent}`;
    if (!pageSlug.endsWith(suffix)) continue;
    const rest = pageSlug.slice(0, -suffix.length);
    const lastDash = rest.lastIndexOf('-');
    if (lastDash <= 0) continue;
    const anoPart = rest.slice(lastDash + 1);
    const modeloSlug = rest.slice(0, lastDash);
    if (!modeloSlug) continue;
    let ano: number;
    if (anoPart === 'zero-km') ano = 0;
    else {
      ano = parseInt(anoPart, 10);
      if (Number.isNaN(ano)) continue;
    }
    return { modeloSlug, ano, intent };
  }
  return null;
}

export function isReservedMarcaSlug(marcaSlug: string): boolean {
  return RESERVED_ROOT_SEGMENTS.has(marcaSlug);
}

let marcaClustersCache: MarcaClusterData[] | null = null;
let decisaoIndexCache: DecisaoIndex | null = null;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadMarcaCluster(slug: string): Promise<MarcaClusterData | null> {
  if (!marcaClustersCache) {
    marcaClustersCache =
      (await fetchJson<MarcaClusterData[]>('/data/semantic/marca-clusters.json')) ?? [];
  }
  return marcaClustersCache.find((c) => c.slug === slug) ?? null;
}

export async function loadDecisaoIndex(): Promise<DecisaoIndex> {
  if (!decisaoIndexCache) {
    const data = await fetchJson<DecisaoIndex>('/data/semantic/decisao-index.json');
    decisaoIndexCache = data ?? { valeAPena: [], comparativosOu: [], melhoresSegmento: [] };
  }
  return decisaoIndexCache;
}

export type DecisaoMatch =
  | { kind: 'vale-a-pena'; entry: DecisaoValeAPena }
  | { kind: 'comparativo-ou'; entry: DecisaoComparativoOu }
  | { kind: 'melhores'; entry: DecisaoMelhoresSegmento };

let decisaoSlugMaps: {
  valeAPena: Map<string, DecisaoValeAPena>;
  comparativosOu: Map<string, DecisaoComparativoOu>;
  melhoresSegmento: Map<string, DecisaoMelhoresSegmento>;
} | null = null;

function buildDecisaoMaps(index: DecisaoIndex) {
  decisaoSlugMaps = {
    valeAPena: new Map(index.valeAPena.map((e) => [e.slug, e])),
    comparativosOu: new Map(index.comparativosOu.map((e) => [e.slug, e])),
    melhoresSegmento: new Map(index.melhoresSegmento.map((e) => [e.slug, e])),
  };
}

export async function matchDecisaoSlug(slug: string): Promise<DecisaoMatch | null> {
  if (isReservedMarcaSlug(slug)) return null;
  const index = await loadDecisaoIndex();
  if (!decisaoSlugMaps) buildDecisaoMaps(index);
  const maps = decisaoSlugMaps!;
  const vale = maps.valeAPena.get(slug);
  if (vale) return { kind: 'vale-a-pena', entry: vale };
  const ou = maps.comparativosOu.get(slug);
  if (ou) return { kind: 'comparativo-ou', entry: ou };
  const melhores = maps.melhoresSegmento.get(slug);
  if (melhores) return { kind: 'melhores', entry: melhores };
  return null;
}

function formatAnoLabel(ano: number): string {
  return ano === 0 ? 'Zero KM' : String(ano);
}

function versoesDoAno(modelo: SeoModelo, ano: number) {
  return modelo.versoes.filter((v) => v.ano === ano);
}

function precoMedioAno(modelo: SeoModelo, ano: number): number | null {
  const versoes = versoesDoAno(modelo, ano);
  if (!versoes.length) return null;
  return Math.round(versoes.reduce((s, v) => s + v.valor, 0) / versoes.length);
}

function fipeDisponiveisSection(modelo: SeoModelo, ano: number): IntentSection {
  const versoes = versoesDoAno(modelo, ano);
  const media = precoMedioAno(modelo, ano);
  const lines: string[] = [];
  if (versoes.length) {
    lines.push(
      `${versoes.length} versão(ões) do ${modelo.modeloNome} ${formatAnoLabel(ano)} indexadas na FIPE.`,
    );
  }
  if (media != null) {
    lines.push(`Preço médio FIPE do ano: R$ ${media.toLocaleString('pt-BR')}.`);
  }
  lines.push(
    'Conteúdo técnico complementar será publicado após enriquecimento do catálogo (enriquecimento pendente).',
  );
  return {
    heading: 'Dados FIPE disponíveis',
    body: lines.join(' '),
  };
}

function baseLinks(modelo: SeoModelo, ano: number): IntentLink[] {
  const { marcaSlug, modeloSlug } = modelo;
  return [
    { label: 'Preço FIPE', href: intentPath(marcaSlug, modeloSlug, ano, 'preco') },
    { label: 'Histórico de preços', href: historicoPath(marcaSlug, modeloSlug) },
    { label: 'Página do modelo', href: modeloPath(marcaSlug, modeloSlug) },
    {
      label: 'Vale a pena comprar?',
      href: decisaoValeAPenaPath(marcaSlug, modeloSlug, ano),
    },
  ];
}

export function buildIntentContent(
  modelo: SeoModelo,
  ano: number,
  intent: SemanticIntent,
): IntentContent {
  const display = `${modelo.marcaNome} ${modelo.modeloNome}`;
  const anoLabel = formatAnoLabel(ano);
  const versoes = versoesDoAno(modelo, ano);
  const media = precoMedioAno(modelo, ano);
  const min =
    versoes.length > 0 ? Math.min(...versoes.map((v) => v.valor)) : modelo.historico.menorPreco;
  const max =
    versoes.length > 0 ? Math.max(...versoes.map((v) => v.valor)) : modelo.historico.maiorPreco;
  const links = baseLinks(modelo, ano);
  const faq: IntentContent['faq'] = [];

  if (ENRICHMENT_PENDING_INTENTS.includes(intent)) {
    const topic =
      intent === 'consumo'
        ? 'Consumo'
        : intent === 'manutencao'
          ? 'Manutenção'
          : intent === 'problemas'
            ? 'Problemas crônicos'
            : 'Seguro';
    return {
      title: `${topic} ${display} ${anoLabel} | PesquisaTabelaFIPE`,
      description: `Consulte preços FIPE do ${display} ${anoLabel}. Dados de ${topic.toLowerCase()} em enriquecimento.`,
      sections: [fipeDisponiveisSection(modelo, ano)],
      links: [
        ...links,
        {
          label: 'FIPE atualizada',
          href: intentPath(modelo.marcaSlug, modelo.modeloSlug, ano, 'fipe-atualizada'),
        },
      ],
      faq: [
        {
          pergunta: `Qual o preço FIPE do ${display} ${anoLabel}?`,
          resposta:
            media != null
              ? `A média das versões indexadas é R$ ${media.toLocaleString('pt-BR')}.`
              : 'Consulte a página de preço FIPE para valores por versão.',
        },
      ],
    };
  }

  if (intent === 'preco' || intent === 'fipe-atualizada') {
    const sections: IntentSection[] = [];
    if (versoes.length) {
      sections.push({
        heading: 'Valores por versão',
        body: versoes
          .map(
            (v) =>
              `${v.combustivel}: R$ ${v.valor.toLocaleString('pt-BR')}${v.fipeCodigo ? ` (cód. ${v.fipeCodigo})` : ''}`,
          )
          .join(' • '),
      });
    }
    if (min != null && max != null) {
      sections.push({
        heading: 'Faixa FIPE do ano',
        body: `Menor: R$ ${min.toLocaleString('pt-BR')}. Maior: R$ ${max.toLocaleString('pt-BR')}.${media != null ? ` Média: R$ ${media.toLocaleString('pt-BR')}.` : ''}`,
      });
    }
    if (modelo.historico.pontos.length > 1) {
      const first = modelo.historico.pontos[0];
      const last = modelo.historico.pontos[modelo.historico.pontos.length - 1];
      sections.push({
        heading: 'Histórico agregado do modelo',
        body: `Série FIPE de ${first.referencia} (R$ ${first.valorMedio.toLocaleString('pt-BR')}) a ${last.referencia} (R$ ${last.valorMedio.toLocaleString('pt-BR')}).`,
      });
    }
    faq.push({
      pergunta: `Quanto custa um ${display} ${anoLabel} na tabela FIPE?`,
      resposta:
        media != null
          ? `A média das ${versoes.length} versões indexadas é R$ ${media.toLocaleString('pt-BR')}.`
          : 'Veja a lista de versões acima para valores individuais.',
    });
    return {
      title:
        intent === 'fipe-atualizada'
          ? `FIPE atualizada ${display} ${anoLabel} | PesquisaTabelaFIPE`
          : `Preço FIPE ${display} ${anoLabel} | PesquisaTabelaFIPE`,
      description:
        media != null
          ? `Tabela FIPE ${display} ${anoLabel}: média R$ ${media.toLocaleString('pt-BR')}, ${versoes.length} versões.`
          : `Tabela FIPE ${display} ${anoLabel} — ${versoes.length} versões indexadas.`,
      sections,
      links,
      faq,
    };
  }

  if (intent === 'vale-a-pena') {
    const sections: IntentSection[] = [];
    if (media != null) {
      sections.push({
        heading: 'Referência de preço',
        body: `Preço médio FIPE ${anoLabel}: R$ ${media.toLocaleString('pt-BR')} (${versoes.length} versões).`,
      });
    }
    if (typeof modelo.historico.desvalorizacaoPercentual === 'number') {
      sections.push({
        heading: 'Desvalorização histórica (modelo)',
        body: `Desvalorização agregada registrada: ${modelo.historico.desvalorizacaoPercentual}% na série FIPE disponível.`,
      });
    }
    if (typeof modelo.historico.valorizacaoPercentual === 'number') {
      sections.push({
        heading: 'Valorização histórica (modelo)',
        body: `Valorização agregada: ${modelo.historico.valorizacaoPercentual}%.`,
      });
    }
    sections.push({
      heading: 'Análise de compra',
      body: 'Use os dados FIPE acima e a página dedicada "Vale a pena comprar" para comparar preço, histórico e alternativas.',
    });
    return {
      title: `Vale a pena ${display} ${anoLabel}? | PesquisaTabelaFIPE`,
      description: `Vale a pena comprar ${display} ${anoLabel}? Preço médio FIPE e histórico para apoiar sua decisão.`,
      sections,
      links: [
        ...links,
        {
          label: 'Guia completo: vale a pena comprar',
          href: decisaoValeAPenaPath(modelo.marcaSlug, modelo.modeloSlug, ano),
        },
      ],
      faq: [
        {
          pergunta: `Vale a pena comprar ${display} ${anoLabel}?`,
          resposta:
            media != null
              ? `Com preço médio FIPE de R$ ${media.toLocaleString('pt-BR')}, compare histórico e rivais na página de decisão.`
              : 'Compare histórico FIPE e rivais na página de decisão.',
        },
      ],
    };
  }

  if (intent === 'comparativo') {
    return {
      title: `Comparativo ${display} ${anoLabel} | PesquisaTabelaFIPE`,
      description: `Compare ${display} ${anoLabel} com rivais usando preços FIPE e páginas de comparativo.`,
      sections: [
        {
          heading: 'Dados FIPE deste modelo/ano',
          body:
            media != null
              ? `Média ${anoLabel}: R$ ${media.toLocaleString('pt-BR')}. Total de ${modelo.totalVeiculos} versões do modelo na base.`
              : `${modelo.totalVeiculos} versões do modelo indexadas.`,
        },
        {
          heading: 'Próximo passo',
          body: 'Abra a central de comparativos ou páginas "X ou Y" do mesmo segmento para contrastar preços FIPE reais.',
        },
      ],
      links: [
        ...links,
        { label: 'Central de comparativos', href: compararPath('') },
        { label: 'Clusters da marca', href: clusterPath(modelo.marcaSlug, 'comparacao') },
      ],
      faq: [],
    };
  }

  return {
    title: `${display} ${anoLabel} | PesquisaTabelaFIPE`,
    description: `Informações FIPE do ${display} ${anoLabel}.`,
    sections: [fipeDisponiveisSection(modelo, ano)],
    links,
    faq: [],
  };
}

export function relatedIntentsFor(
  marcaSlug: string,
  modeloSlug: string,
  ano: number,
  current?: SemanticIntent,
): IntentLink[] {
  return INTENTS.filter((i) => i !== current).map((intent) => ({
    label: intent.replace(/-/g, ' '),
    href: intentPath(marcaSlug, modeloSlug, ano, intent),
  }));
}
