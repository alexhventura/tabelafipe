import type { FaqItem } from '../lib/faq';

export const HOME_FAQ: FaqItem[] = [
  {
    pergunta: 'O que é a Tabela FIPE?',
    resposta:
      'É a tabela de preços médios de veículos no mercado brasileiro, publicada pela FIPE. Serve como referência para compra, venda, seguro e financiamento.',
  },
  {
    pergunta: 'Como consultar?',
    resposta:
      'Selecione montadora, modelo, versão e ano no fluxo guiado — ou use a busca rápida abaixo para atalhos por nome ou código FIPE.',
  },
  {
    pergunta: 'Com que frequência atualiza?',
    resposta:
      'Os preços seguem a publicação mensal da Tabela FIPE. Cada página exibe o mês de referência da cotação.',
  },
  {
    pergunta: 'O histórico é confiável?',
    resposta:
      'Sim. O histórico é montado a partir das séries oficiais FIPE associadas a cada código de veículo.',
  },
];

export function buildHomeFaqJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: item.resposta },
    })),
  };
}
