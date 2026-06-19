import { Vehicle } from '../types';
import { formatBRL, formatPct } from './format';
import { computeTrend, vehicleDisplayName } from './vehicle';

export interface FaqItem {
  pergunta: string;
  resposta: string;
}

export function generateFaq(vehicle: Vehicle, mesReferencia = 'Jun/2026'): FaqItem[] {
  const nome = vehicleDisplayName(vehicle);
  const trend6m = computeTrend(vehicle.historicoPrecos, 6);
  const valor6mAtras =
    vehicle.historicoPrecos.length >= 7
      ? vehicle.historicoPrecos[vehicle.historicoPrecos.length - 7].valor
      : null;

  const faqs: FaqItem[] = [
    {
      pergunta: `Qual o valor do ${nome} ${vehicle.anoModelo} na Tabela FIPE?`,
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
      pergunta: `O ${nome} ${vehicle.anoModelo} está valorizando ou desvalorizando?`,
      resposta: `Está ${direcao} ${formatPct(Math.abs(trend6m))} nos últimos 6 meses.`,
    });
  }

  faqs.push({
    pergunta: `Qual o código FIPE do ${nome} ${vehicle.anoModelo}?`,
    resposta: `O código FIPE é ${vehicle.fipeCodigo}, combustível ${vehicle.combustivel}.`,
  });

  return faqs;
}
