export const SITE_URL = 'https://pesquisatabelafipe.com.br';

function parseLimit(name: string): number {
  const raw = process.env[name];
  if (!raw || raw === '0') return Infinity;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

export const SSG_LIMITS = {
  vehicles: parseLimit('SSG_LIMIT_VEHICLES'),
  families: parseLimit('SSG_LIMIT_FAMILIES'),
  generations: parseLimit('SSG_LIMIT_GENERATIONS'),
  engines: parseLimit('SSG_LIMIT_ENGINES'),
  platforms: parseLimit('SSG_LIMIT_PLATFORMS'),
};

export function isPhase1(): boolean {
  return Number.isFinite(SSG_LIMITS.vehicles) && SSG_LIMITS.vehicles <= 1000;
}
