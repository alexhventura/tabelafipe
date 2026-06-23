import type { VehiclePageBundle } from '../types/bundle';
import { formatMesReferencia } from './vehiclePageData';

export interface VehicleSourceRef {
  nome: string;
  origem: string;
  atualizado?: string;
  disponivel: boolean;
}

export function formatCompactSourcesLine(bundle: VehiclePageBundle): {
  atualizacao: string;
  fontes: string[];
} {
  const atualizacao = formatMesReferencia(bundle.fipe.mesReferencia);
  const fontes = ['FIPE', 'INMETRO', 'Latin NCAP', 'Fabricante', 'Campanhas oficiais de recall'];
  return { atualizacao, fontes };
}

export function buildVehicleSources(bundle: VehiclePageBundle): VehicleSourceRef[] {
  const ref = formatMesReferencia(bundle.fipe.mesReferencia);
  const gerado = bundle.geradoEm ? new Date(bundle.geradoEm).toLocaleDateString('pt-BR') : undefined;

  return [
    {
      nome: 'Preço FIPE e histórico',
      origem: 'FIPE — Fundação Instituto de Pesquisas Econômicas',
      atualizado: ref,
      disponivel: bundle.sections.preco && bundle.fipe.valorAtual > 0,
    },
    {
      nome: 'Consumo homologado',
      origem: 'INMETRO — Programa Brasileiro de Etiquetagem Veicular (PBEV)',
      atualizado: ref,
      disponivel: bundle.sections.inmetro && !!bundle.inmetro,
    },
    {
      nome: 'Segurança veicular',
      origem: 'Latin NCAP',
      atualizado: ref,
      disponivel: !!bundle.safety,
    },
    {
      nome: 'Especificações técnicas',
      origem: 'Montadoras e manuais do fabricante',
      atualizado: ref,
      disponivel: bundle.sections.specs && !!bundle.specs,
    },
    {
      nome: 'Manutenção preventiva',
      origem: 'Dados técnicos consolidados e manuais do fabricante',
      atualizado: ref,
      disponivel: !!bundle.maintenance,
    },
    {
      nome: 'Campanhas de recall',
      origem: 'Registros públicos de segurança veicular',
      atualizado: ref,
      disponivel: !!bundle.recalls,
    },
    {
      nome: 'Associação e apresentação',
      origem: 'PesquisaTabelaFIPE — processamento próprio por código FIPE',
      atualizado: gerado,
      disponivel: true,
    },
  ];
}
