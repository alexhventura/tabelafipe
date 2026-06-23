import { Vehicle } from '../types';
import { formatYearLabel } from './displayYear';
import { formatBRL, formatPct } from './format';
import { computeTrend, vehicleDisplayName } from './vehicle';

export interface FaqItem {
  pergunta: string;
  resposta: string;
}

function yearPhrase(vehicle: Vehicle): string {
  const label = formatYearLabel(vehicle.anoModelo);
  return label ? ` ${label}` : '';
}

export function generateFaq(vehicle: Vehicle, mesReferencia = 'Jun/2026'): FaqItem[] {
  const nome = vehicleDisplayName(vehicle);
  const anoTxt = yearPhrase(vehicle);
  const trend6m = computeTrend(vehicle.historicoPrecos, 6);
  const valor6mAtras =
    vehicle.historicoPrecos.length >= 7
      ? vehicle.historicoPrecos[vehicle.historicoPrecos.length - 7].valor
      : null;

  const faqs: FaqItem[] = [
    {
      pergunta: `Qual o valor do ${nome}${anoTxt} na Tabela FIPE?`,
      resposta: `O valor de referência é ${formatBRL(vehicle.valorAtual)} (${mesReferencia}).`,
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
      pergunta: `O ${nome}${anoTxt} está valorizando ou desvalorizando?`,
      resposta: `Está ${direcao} ${formatPct(Math.abs(trend6m))} nos últimos 6 meses.`,
    });
  }

  faqs.push({
    pergunta: `Qual o código FIPE do ${nome}${anoTxt}?`,
    resposta: `O código FIPE é ${vehicle.fipeCodigo}, combustível ${vehicle.combustivel}.`,
  });

  return faqs;
}
