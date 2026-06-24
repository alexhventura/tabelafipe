import type { FaqItem, HistoricoPonto, RelatedLink, VehiclePageBundle } from '../types/bundle';
import { formatBRL, formatPct } from './format';
import {
  formatYearLabel,
  formatYearWithPrefix,
  getIdentityDisplayYear,
} from './displayYear';
import { formatVehicleTitle, sanitizeDisplayText } from './display';
import { buildConsumoRows, formatConsumoResumo } from './consumoDisplay';
import { normalizeFuelType } from './fuelType';
import { extractFamilyName, modeloTokens } from './modelFamily';
import {
  inferComparableBodyType,
  pickTopSimilarVehicles,
  similarityScore,
  type SimilarityVehicleInput,
} from './vehicleSimilarity';

export interface QuickCard {
  label: string;
  value: string;
}

export interface HistoricoStats {
  min: number;
  max: number;
  minMes: string;
  maxMes: string;
  variacaoMensal: number | null;
  variacao12m: number | null;
  variacao24m: number | null;
  variacaoTotal: number | null;
  insight: string | null;
}

export interface SpecGroup {
  title: string;
  rows: { label: string; value: string }[];
}

export interface InternalNavLink {
  label: string;
  path: string;
  hint?: string;
}

function trendBetween(historico: HistoricoPonto[], monthsBack: number): number | null {
  if (historico.length < 2) return null;
  const latest = historico[historico.length - 1];
  const idx = historico.length - 1 - monthsBack;
  if (idx < 0) return null;
  const past = historico[idx];
  if (!past.valor) return null;
  return ((latest.valor - past.valor) / past.valor) * 100;
}

export function computeHistoricoStats(historico: HistoricoPonto[]): HistoricoStats | null {
  if (!historico.length) return null;

  let min = historico[0];
  let max = historico[0];
  for (const p of historico) {
    if (p.valor < min.valor) min = p;
    if (p.valor > max.valor) max = p;
  }

  const variacaoMensal = historico.length >= 2
    ? ((historico[historico.length - 1].valor - historico[historico.length - 2].valor) /
        historico[historico.length - 2].valor) *
      100
    : null;
  const variacao12m = trendBetween(historico, 12);
  const variacao24m = trendBetween(historico, 24);
  const variacaoTotal =
    historico.length >= 2
      ? ((historico[historico.length - 1].valor - historico[0].valor) / historico[0].valor) * 100
      : null;

  let insight: string | null = null;
  if (variacao12m != null) {
    const verb = variacao12m >= 0 ? 'Valorizou' : 'Desvalorizou';
    insight = `${verb} ${formatPct(Math.abs(variacao12m)).replace('+', '')} nos últimos 12 meses.`;
  } else if (variacaoMensal != null) {
    const verb = variacaoMensal >= 0 ? 'Valorizou' : 'Desvalorizou';
    insight = `${verb} ${formatPct(Math.abs(variacaoMensal)).replace('+', '')} no último mês.`;
  }

  return {
    min: min.valor,
    max: max.valor,
    minMes: min.referencia ?? min.mes ?? '',
    maxMes: max.referencia ?? max.mes ?? '',
    variacaoMensal,
    variacao12m,
    variacao24m,
    variacaoTotal,
    insight,
  };
}

export function buildQuickCards(bundle: VehiclePageBundle): QuickCard[] {
  const specs = bundle.specs as Record<string, unknown> | null;
  const engine = bundle.engine?.entity as Record<string, unknown> | null;
  const cards: QuickCard[] = [];

  const potencia = specs?.potenciaCv ?? engine?.potencia;
  if (potencia) cards.push({ label: 'Potência', value: `${potencia} cv` });

  const torque = specs?.torqueNm ?? engine?.torqueNm;
  if (torque) cards.push({ label: 'Torque', value: `${torque} Nm` });

  const cambio =
    (specs?.cambio as string) ??
    bundle.transmission?.transmissionNome ??
    (engine?.cambio as string);
  if (cambio) cards.push({ label: 'Transmissão', value: String(cambio) });

  const consumoResumo = formatConsumoResumo(bundle);
  if (consumoResumo) {
    const label = normalizeFuelType(bundle.identity.combustivel) === 'eletrico' ? 'Eficiência' : 'Consumo cidade';
    cards.push({ label, value: consumoResumo.replace(/^[^:]+:\s*/, '') });
  }

  const portaMalas = specs?.portaMalasL as number | undefined;
  if (portaMalas) cards.push({ label: 'Porta-malas', value: `${portaMalas} L` });

  if (bundle.platform?.platformNome) {
    cards.push({ label: 'Plataforma', value: bundle.platform.platformNome });
  }

  if (bundle.engine?.engineNome) {
    cards.push({ label: 'Motor', value: bundle.engine.engineNome });
  }

  return cards;
}

export function buildSpecGroups(bundle: VehiclePageBundle): SpecGroup[] {
  const specs = bundle.specs as Record<string, unknown> | null;
  const engine = bundle.engine?.entity as Record<string, unknown> | null;
  const groups: SpecGroup[] = [];

  const motorRows: { label: string; value: string }[] = [];
  if (bundle.engine?.engineNome) motorRows.push({ label: 'Motor', value: bundle.engine.engineNome });
  if (specs?.potenciaCv) motorRows.push({ label: 'Potência', value: `${specs.potenciaCv} cv` });
  if (specs?.torqueNm) motorRows.push({ label: 'Torque', value: `${specs.torqueNm} Nm` });
  if (specs?.cilindradaCc) motorRows.push({ label: 'Cilindrada', value: `${specs.cilindradaCc} cc` });
  if (engine?.oleo) motorRows.push({ label: 'Óleo', value: String(engine.oleo) });
  if (motorRows.length) groups.push({ title: 'Motor', rows: motorRows });

  const cambio =
    (specs?.cambio as string) ??
    bundle.transmission?.transmissionNome ??
    (engine?.cambio as string);
  if (cambio) groups.push({ title: 'Transmissão', rows: [{ label: 'Câmbio', value: String(cambio) }] });

  const dimRows: { label: string; value: string }[] = [];
  if (specs?.comprimentoMm) dimRows.push({ label: 'Comprimento', value: `${specs.comprimentoMm} mm` });
  if (specs?.larguraMm) dimRows.push({ label: 'Largura', value: `${specs.larguraMm} mm` });
  if (specs?.alturaMm) dimRows.push({ label: 'Altura', value: `${specs.alturaMm} mm` });
  if (specs?.pesoKg) dimRows.push({ label: 'Peso', value: `${specs.pesoKg} kg` });
  if (dimRows.length) groups.push({ title: 'Dimensões', rows: dimRows });

  const capRows: { label: string; value: string }[] = [];
  if (specs?.portaMalasL) capRows.push({ label: 'Porta-malas', value: `${specs.portaMalasL} L` });
  if (specs?.tanqueL) capRows.push({ label: 'Tanque', value: `${specs.tanqueL} L` });
  if (engine?.capacidadeOleoL) capRows.push({ label: 'Óleo (motor)', value: `${engine.capacidadeOleoL} L` });
  if (capRows.length) groups.push({ title: 'Capacidades', rows: capRows });

  const perfRows: { label: string; value: string }[] = [];
  if (specs?.aceleracao0a100) perfRows.push({ label: '0–100 km/h', value: `${specs.aceleracao0a100} s` });
  if (specs?.velocidadeMaxKmh) perfRows.push({ label: 'Velocidade máxima', value: `${specs.velocidadeMaxKmh} km/h` });
  if (perfRows.length) groups.push({ title: 'Desempenho', rows: perfRows });

  return groups;
}

export { buildConsumoRows } from './consumoDisplay';

export function buildMaintenanceRows(bundle: VehiclePageBundle): { label: string; value: string }[] {
  const m = bundle.maintenance as Record<string, unknown> | null;
  const engine = bundle.engine?.entity as Record<string, unknown> | null;
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value: unknown) => {
    if (value == null || value === '') return;
    rows.push({ label, value: Array.isArray(value) ? value.join(', ') : String(value) });
  };
  push('Óleo recomendado', m?.oleo ?? engine?.oleo);
  push('Capacidade de óleo', engine?.capacidadeOleoL ? `${engine.capacidadeOleoL} L` : null);
  push('Pneus', m?.pneus);
  push('Fluido de arrefecimento', m?.fluidoArrefecimento ?? m?.fluido);
  push('Velas', m?.velas);
  push('Bateria', m?.bateria);
  return rows;
}

export function pickOutrasVersoes(bundle: VehiclePageBundle): RelatedLink[] {
  const id = bundle.identity.vehicleId;
  return bundle.related.mesmaFamilia.filter((l) => l.vehicleId !== id).slice(0, 8);
}

export function buildVehicleBreadcrumb(bundle: VehiclePageBundle): { name: string; path?: string }[] {
  const { identity } = bundle;
  const famSlug =
    bundle.generation?.familia?.split('|')[1] ?? extractFamilyName(identity.modelo);
  const famDisplay = famSlug ? formatFamilyHint(famSlug) : null;

  const crumbs: { name: string; path?: string }[] = [{ name: 'Home', path: '/' }];

  crumbs.push({
    name: identity.marca,
    path: `/fipe/${identity.marcaSlug}/`,
  });

  if (famDisplay && famSlug) {
    crumbs.push({
      name: famDisplay,
      path: `/fipe/${identity.marcaSlug}/${famSlug}/`,
    });
  }

  crumbs.push({ name: buildBreadcrumbLeafName(bundle) });
  return crumbs;
}

/** Nome curto para o último nível do breadcrumb — ex.: "Corolla XEi 2024". */
export function buildBreadcrumbLeafName(bundle: VehiclePageBundle): string {
  const { identity } = bundle;
  let label = identity.displayName
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(new RegExp(`^${identity.marca}\\s+`, 'i'), '')
    .trim();

  const engineCut = label.match(/^(.+?)\s+\d+\.\d+/);
  if (engineCut) label = engineCut[1].trim();

  const specCut = label.match(/^(.+?)\s+(flex|hibrido|hybrid|diesel|turbo|aut\.?|mec\.?)\b/i);
  if (specCut) label = specCut[1].trim();

  const year = formatYearLabel(identity.ano);
  return year ? `${label} ${year}` : label;
}

function familyTokensFromModelo(modelo: string): string[] {
  const tokens = new Set<string>();
  const primary = extractFamilyName(modelo);
  if (primary.length >= 3) tokens.add(primary);
  for (const w of modeloTokens(modelo)) {
    if (w.length >= 4) tokens.add(w);
  }
  return [...tokens];
}

function isSameModelFamily(displayName: string, tokens: string[]): boolean {
  const name = displayName.toLowerCase();
  return tokens.some((t) => t.length >= 3 && name.includes(t));
}

export function pickConcorrentes(bundle: VehiclePageBundle): RelatedLink[] {
  const { identity, fipe } = bundle;
  const current: SimilarityVehicleInput = {
    tipo: identity.tipo,
    modelo: identity.modelo,
    marca: identity.marca,
    ano: identity.ano,
    valorAtual: fipe.valorAtual,
  };

  const tokens = familyTokensFromModelo(identity.modelo);
  const excluded = new Set<string>([identity.vehicleId]);
  for (const v of bundle.related.mesmaFamilia) excluded.add(v.vehicleId);

  const pool = [...bundle.related.concorrentes, ...bundle.related.mesmaFaixaPreco];
  const byId = new Map<string, SimilarityVehicleInput & { vehicleId: string; link: RelatedLink }>();

  for (const link of pool) {
    if (byId.has(link.vehicleId)) continue;
    if (excluded.has(link.vehicleId)) continue;
    if (isSameModelFamily(link.displayName, tokens)) continue;

    const candidate: SimilarityVehicleInput & { vehicleId: string; link: RelatedLink } = {
      vehicleId: link.vehicleId,
      link,
      tipo: link.tipo ?? identity.tipo,
      modelo: link.modelo ?? link.displayName.replace(new RegExp(`^${identity.marca}\\s+`, 'i'), '').trim(),
      marca: link.marca,
      ano: link.ano,
      valorAtual: link.valorAtual,
    };

    if (similarityScore(current, candidate) <= 0) continue;
    byId.set(link.vehicleId, candidate);
  }

  const ranked = pickTopSimilarVehicles(current, [...byId.values()], {
    limit: 12,
    minScore: 50,
    excludeIds: excluded,
  });

  const groups = new Map<string, RelatedLink>();
  for (const item of ranked) {
    const modelKey = item.link.displayName.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
    const key = `${item.link.marca}|${modelKey}`;
    const existing = groups.get(key);
    if (!existing || Math.abs(item.ano - identity.ano) < Math.abs(existing.ano - identity.ano)) {
      groups.set(key, item.link);
    }
  }

  return [...groups.values()].slice(0, 6);
}

export { inferComparableBodyType, similarityScore };

export function buildInternalNav(bundle: VehiclePageBundle): InternalNavLink[] {
  const { marcaSlug, modelo } = bundle.identity;
  const links: InternalNavLink[] = [];
  const famSlug =
    bundle.generation?.familia?.split('|')[1] ?? extractFamilyName(modelo);

  if (famSlug) {
    links.push({
      label: 'Família',
      path: `/fipe/${marcaSlug}/${famSlug}/`,
      hint: formatFamilyHint(famSlug),
    });
  }
  if (bundle.generation?.geracaoId) {
    const label =
      (bundle.generation.catalogEntry?.label as string) ?? bundle.generation.geracaoId;
    links.push({
      label: 'Geração',
      path: `/geracao/${marcaSlug}/${bundle.generation.geracaoId}`,
      hint: label,
    });
  }
  if (bundle.platform?.platformId) {
    links.push({
      label: 'Plataforma',
      path: `/plataforma/${bundle.platform.platformId}`,
      hint: bundle.platform.platformNome ?? undefined,
    });
  }
  if (bundle.engine?.engineId) {
    links.push({
      label: 'Motor',
      path: `/motor/${bundle.engine.engineId}`,
      hint: bundle.engine.engineNome ?? undefined,
    });
  }
  links.push({ label: 'Marca', path: `/fipe/${marcaSlug}/`, hint: bundle.identity.marca });
  return links;
}

function formatFamilyHint(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function faqYearPhrase(identity: VehiclePageBundle['identity']): string {
  const label = getIdentityDisplayYear(identity).label;
  return label ? ` ${label}` : '';
}

export function buildEnhancedFaq(bundle: VehiclePageBundle): FaqItem[] {
  const { identity, fipe, specs } = bundle;
  const inmetro = bundle.inmetro;
  const nome = identity.displayName;
  const anoTxt = faqYearPhrase(identity);
  const stats = computeHistoricoStats(fipe.historico);

  const generated: FaqItem[] = [
    {
      pergunta: `Qual o valor FIPE do ${nome}${anoTxt}?`,
      resposta: `O valor de referência na Tabela FIPE é ${formatBRL(fipe.valorAtual)} (código ${fipe.fipeCodigo}, referência ${fipe.mesReferencia}).`,
    },
  ];

  if (stats?.variacao12m != null) {
    const dir = stats.variacao12m >= 0 ? 'valorizou' : 'desvalorizou';
    generated.push({
      pergunta: `O ${nome}${anoTxt} valorizou ou desvalorizou?`,
      resposta: `Nos últimos 12 meses, o veículo ${dir} ${formatPct(Math.abs(stats.variacao12m)).replace('+', '')} segundo o histórico FIPE.`,
    });
  }

  if (inmetro?.consumoCidade) {
    const consumoRows = buildConsumoRows(bundle);
    const resumo = consumoRows
      .filter((r) => !['Classificação INMETRO', 'Combustível', 'Propulsão'].includes(r.label))
      .map((r) => `${r.label}: ${r.value}`)
      .join('; ');
    if (resumo) {
      generated.push({
        pergunta: `Qual o consumo do ${nome}${anoTxt}?`,
        resposta: `Dados homologados no INMETRO (PBEV): ${resumo}.`,
      });
    }
  }

  generated.push({
    pergunta: `Vale a pena comprar um ${nome}${anoTxt} usado?`,
    resposta: buildUsedCarFaqAnswer(bundle, stats),
  });

  if (specs?.portaMalasL) {
    generated.push({
      pergunta: `Qual o porta-malas do ${nome}${anoTxt}?`,
      resposta: `O porta-malas tem capacidade de ${specs.portaMalasL} litros.`,
    });
  }

  const cambio = specs?.cambio as string | undefined;
  if (cambio) {
    generated.push({
      pergunta: `Qual a transmissão do ${nome}${anoTxt}?`,
      resposta: `Esta versão utiliza câmbio ${cambio}.`,
    });
  }

  const potencia = specs?.potenciaCv;
  if (potencia) {
    generated.push({
      pergunta: `Qual a potência do ${nome}${anoTxt}?`,
      resposta: `A potência declarada é de ${potencia} cv.`,
    });
  }

  const seen = new Set<string>();
  const merged: FaqItem[] = [];
  for (const item of [...generated, ...bundle.faq]) {
    const key = item.pergunta.toLowerCase().slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function buildUsedCarFaqAnswer(
  bundle: VehiclePageBundle,
  stats: HistoricoStats | null,
): string {
  const { identity, fipe } = bundle;
  const anoTxt = faqYearPhrase(identity);
  const parts: string[] = [
    `O ${identity.displayName}${anoTxt} está cotado em ${formatBRL(fipe.valorAtual)} na Tabela FIPE.`,
  ];
  if (stats?.variacao12m != null) {
    const trend = stats.variacao12m >= 0 ? 'valorização' : 'desvalorização';
    parts.push(
      `Nos últimos 12 meses houve ${trend} de ${formatPct(Math.abs(stats.variacao12m)).replace('+', '')}.`,
    );
  }
  if (bundle.inmetro?.consumoCidade) {
    const resumo = formatConsumoResumo(bundle);
    if (resumo) parts.push(`${resumo}.`);
  }
  if (bundle.safety?.notaGeral != null) {
    parts.push(`Em segurança, registra nota ${bundle.safety.notaGeral} no Latin NCAP.`);
  }
  if ((bundle.recalls?.ativos as number) > 0) {
    parts.push(`Verifique ${String(bundle.recalls?.ativos)} recall(s) ativo(s) antes de fechar negócio.`);
  }
  parts.push('Compare concorrentes, histórico FIPE e estado de conservação antes de comprar.');
  return parts.join(' ');
}

export function formatMesReferencia(mesRef: string): string {
  const map: Record<string, string> = {
    jan: 'Janeiro', fev: 'Fevereiro', mar: 'Março', abr: 'Abril', mai: 'Maio', jun: 'Junho',
    jul: 'Julho', ago: 'Agosto', set: 'Setembro', out: 'Outubro', nov: 'Novembro', dez: 'Dezembro',
  };
  const m = mesRef.match(/^([A-Za-z]{3})\/(\d{2,4})$/);
  if (!m) return mesRef;
  const month = map[m[1].toLowerCase()] ?? m[1];
  const year = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${month}/${year}`;
}

export function buildFaqJsonLd(faq: FaqItem[]): Record<string, unknown> | null {
  if (!faq.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta },
    })),
  };
}

export function buildSeoArticle(bundle: VehiclePageBundle): string | null {
  const { identity, fipe, specs } = bundle;
  const stats = computeHistoricoStats(fipe.historico);
  const inmetro = bundle.inmetro;
  const engine = bundle.engine;
  const platform = bundle.platform;
  const safety = bundle.safety;
  const nome = identity.displayName;
  const anoTxt = faqYearPhrase(identity);
  const paragraphs: string[] = [];

  paragraphs.push(
    `O ${nome}${anoTxt} é uma das referências consultadas na Tabela FIPE com o código ${fipe.fipeCodigo}. ` +
      `Nesta página você encontra o preço atualizado de ${formatBRL(fipe.valorAtual)}, referência ${fipe.mesReferencia}, ` +
      `além de histórico de preços, ficha técnica e veículos relacionados para apoiar sua decisão de compra, venda ou avaliação.`,
  );

  const posParts: string[] = [];
  if (specs?.potenciaCv) posParts.push(`${specs.potenciaCv} cv de potência`);
  if (specs?.cambio) posParts.push(`câmbio ${specs.cambio as string}`);
  if (identity.combustivel) posParts.push(`combustível ${identity.combustivel}`);
  if (posParts.length) {
    paragraphs.push(
      `No mercado brasileiro, esta configuração se posiciona com ${posParts.join(', ')}. ` +
        `A combinação de motorização e equipamentos define o perfil de uso urbano, viagem e revenda do modelo.`,
    );
  }

  if (stats && fipe.historico.length > 6) {
    const trendText =
      stats.variacao12m != null
        ? stats.variacao12m >= 0
          ? `valorização de ${formatPct(stats.variacao12m).replace('+', '')} em 12 meses`
          : `queda de ${formatPct(Math.abs(stats.variacao12m)).replace('+', '')} em 12 meses`
        : 'variação estável no curto prazo';
    paragraphs.push(
      `O histórico FIPE registra ${fipe.historico.length} meses de referência para este código. ` +
        `O menor valor registrado foi ${formatBRL(stats.min)} e o maior ${formatBRL(stats.max)}, com ${trendText}. ` +
        `Acompanhar essa curva ajuda a identificar o melhor momento para negociar.`,
    );
  }

  if (inmetro?.consumoCidade) {
    const rows = buildConsumoRows(bundle)
      .filter((r) => !['Classificação INMETRO', 'Combustível', 'Propulsão'].includes(r.label))
      .map((r) => `${r.label.toLowerCase()}: ${r.value}`)
      .join(', ');
    if (rows) {
      paragraphs.push(
        `Em eficiência energética, o INMETRO homologa ${rows}` +
          (inmetro.classificacaoEnergetica ? `, com classificação ${inmetro.classificacaoEnergetica}` : '') +
          `. Esses números são úteis para estimar custo de uso diário e comparar com rivais da mesma categoria.`,
      );
    }
  }

  if (engine?.engineNome || platform?.platformNome) {
    paragraphs.push(
      `${engine?.engineNome ? `O conjunto mecânico inclui o motor ${engine.engineNome}. ` : ''}` +
        `${platform?.platformNome ? `A plataforma ${platform.platformNome} influencia dirigibilidade, espaço interno e evolução tecnológica da geração. ` : ''}` +
        `Esses elementos explicam diferenças de preço entre versões aparentemente próximas.`,
    );
  }

  if (safety?.notaGeral != null) {
    paragraphs.push(
      `Em segurança, há registro Latin NCAP com nota geral ${safety.notaGeral}` +
        (safety.protecaoAdultos != null ? `, proteção a adultos ${safety.protecaoAdultos}%` : '') +
        (safety.protecaoInfantis != null ? ` e proteção a crianças ${safety.protecaoInfantis}%` : '') +
        `. Recomenda-se verificar recalls e condição de manutenção antes da compra de qualquer seminovo.`,
    );
  }

  paragraphs.push(
    `Para aprofundar a pesquisa, utilize os links para outras versões do mesmo modelo, concorrentes diretos e hubs de família, geração e plataforma. ` +
      `Cada código FIPE representa uma página única — esta é a referência completa para o ${nome}${anoTxt} (${fipe.fipeCodigo}).`,
  );

  const text = paragraphs.join('\n\n');
  const words = text.split(/\s+/).length;
  if (words < 120) return null;
  return text;
}

export function categoryConsumoHint(bundle: VehiclePageBundle): string | null {
  const fuel = normalizeFuelType(bundle.identity.combustivel);
  if (fuel === 'eletrico' || fuel === 'hibrido' || fuel === 'hibrido_plug_in') return null;
  const consumo = bundle.inmetro?.consumoCidade as number | undefined;
  if (!consumo) return null;
  const mediaEstimada = 11.5;
  if (consumo >= mediaEstimada + 1) {
    return `Consumo acima da média estimada para veículos similares (~${mediaEstimada} km/l na cidade).`;
  }
  if (consumo <= mediaEstimada - 1) {
    return `Consumo abaixo da média estimada para veículos similares (~${mediaEstimada} km/l na cidade).`;
  }
  return `Consumo próximo da média estimada para veículos similares (~${mediaEstimada} km/l na cidade).`;
}
