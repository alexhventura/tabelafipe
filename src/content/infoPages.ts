export interface InfoPageContent {
  title: string;
  description: string;
  sections: { heading?: string; paragraphs: string[] }[];
}

export const INFO_PAGES: Record<string, InfoPageContent> = {
  sobre: {
    title: 'Sobre o portal',
    description: 'Conheça o PesquisaTabelaFIPE — consulta FIPE gratuita e informações completas do veículo.',
    sections: [
      {
        paragraphs: [
          'O PesquisaTabelaFIPE é um portal automotivo independente que reúne preços da Tabela FIPE, histórico de valores, ficha técnica, consumo homologado, segurança e outras informações úteis para quem compra, vende ou avalia um veículo.',
          'Nosso objetivo é oferecer uma experiência simples, rápida e confiável — sem exigir cadastro e sem linguagem técnica desnecessária.',
        ],
      },
    ],
  },
  metodologia: {
    title: 'Metodologia',
    description: 'Como organizamos, atualizamos e apresentamos os dados do portal.',
    sections: [
      {
        heading: 'Coleta e atualização',
        paragraphs: [
          'Os preços FIPE são obtidos das publicações oficiais da tabela de referência. Dados complementares — como consumo INMETRO, notas Latin NCAP e campanhas de recall — vêm de fontes públicas homologadas e são associados a cada veículo quando disponíveis.',
          'O catálogo é atualizado periodicamente. A data de referência FIPE exibida em cada página indica o mês da última cotação oficial utilizada.',
        ],
      },
      {
        heading: 'Transparência',
        paragraphs: [
          'Cada página de veículo indica a origem das informações exibidas. Quando um dado não está disponível para aquela versão, a seção correspondente não é mostrada.',
        ],
      },
    ],
  },
  'fontes-dados': {
    title: 'Fontes dos dados',
    description: 'Origem das informações exibidas no portal.',
    sections: [
      {
        paragraphs: [
          'FIPE — Fundação Instituto de Pesquisas Econômicas (preços e histórico).',
          'INMETRO — Programa Brasileiro de Etiquetagem Veicular (consumo).',
          'Latin NCAP — avaliações de segurança veicular.',
          'Montadoras e manuais do fabricante — especificações técnicas quando disponíveis.',
          'Campanhas oficiais de recall — registros públicos de segurança.',
          'Processamento próprio — normalização, associação por código FIPE e apresentação unificada.',
        ],
      },
    ],
  },
  privacidade: {
    title: 'Política de Privacidade',
    description: 'Como tratamos dados no PesquisaTabelaFIPE.',
    sections: [
      {
        paragraphs: [
          'Este portal não exige cadastro para consulta. Podemos utilizar cookies essenciais e ferramentas de análise agregada para melhorar a experiência e medir desempenho.',
          'Não vendemos dados pessoais.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Política de Cookies',
    description: 'Uso de cookies no portal.',
    sections: [
      {
        paragraphs: [
          'Utilizamos cookies necessários ao funcionamento do site e, quando aplicável, cookies de medição de audiência de forma agregada.',
          'Você pode gerenciar cookies nas configurações do seu navegador.',
        ],
      },
    ],
  },
  termos: {
    title: 'Termos de Uso',
    description: 'Condições de uso do PesquisaTabelaFIPE.',
    sections: [
      {
        paragraphs: [
          'O portal é oferecido para consulta informativa. Os valores FIPE são referências de mercado e não substituem laudos, vistorias ou negociações comerciais.',
          'O uso do site implica concordância com estes termos. O conteúdo pode ser atualizado sem aviso prévio.',
        ],
      },
    ],
  },
};
