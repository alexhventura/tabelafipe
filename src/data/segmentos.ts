/** Mapa modelo-base → segmento para alternativas semelhantes */
export const MODELO_SEGMENTO: Record<string, string> = {
  corolla: 'sedan-medio',
  civic: 'sedan-medio',
  sentra: 'sedan-medio',
  cruze: 'sedan-medio',
  jetta: 'sedan-medio',
  onix: 'hatch-popular',
  hb20: 'hatch-popular',
  polo: 'hatch-popular',
  argo: 'hatch-popular',
  '208': 'hatch-popular',
  gol: 'hatch-popular',
  mobi: 'hatch-popular',
  kwid: 'hatch-popular',
  renegade: 'suv-compacto',
  compass: 'suv-compacto',
  creta: 'suv-compacto',
  tracker: 'suv-compacto',
  kicks: 'suv-compacto',
  'hr-v': 'suv-compacto',
  hrv: 'suv-compacto',
};

export const SEGMENTO_RIVAIS: Record<string, string[]> = {
  'sedan-medio': ['corolla', 'civic', 'sentra', 'cruze', 'jetta'],
  'hatch-popular': ['onix', 'hb20', 'polo', 'argo', '208', 'gol'],
  'suv-compacto': ['creta', 'tracker', 'kicks', 'hr-v', 'renegade', 'compass'],
};
