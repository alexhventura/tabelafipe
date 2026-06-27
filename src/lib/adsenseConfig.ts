/** Google AdSense — configure os slot IDs no painel AdSense ou via variáveis VITE_. */
export const ADSENSE_CLIENT = 'ca-pub-6234467433781084';

function readEnv(key: string): string {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return viteEnv?.[key] ?? (typeof process !== 'undefined' ? process.env[key] : undefined) ?? '';
}

export const AD_SLOTS = {
  /** Banner horizontal abaixo do hero (728×90 / 320×50 responsivo) */
  vehicleLeaderboard: readEnv('VITE_ADSENSE_SLOT_VEHICLE_TOP'),
  /** Retângulo médio entre seções (300×250) */
  vehicleRectangle: readEnv('VITE_ADSENSE_SLOT_VEHICLE_MID'),
  /** Retângulo antes do FAQ */
  vehicleBottom: readEnv('VITE_ADSENSE_SLOT_VEHICLE_BOTTOM'),
} as const;

export type AdSlotFormat = 'leaderboard' | 'rectangle' | 'large-rectangle';

export const AD_SLOT_MIN_HEIGHT: Record<AdSlotFormat, number> = {
  leaderboard: 90,
  rectangle: 250,
  'large-rectangle': 280,
};
