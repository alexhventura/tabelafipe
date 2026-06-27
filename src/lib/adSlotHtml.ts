import { AD_SLOT_MIN_HEIGHT, type AdSlotFormat } from './adsenseConfig';

/** Placeholder estático para SSG — reserva altura e evita CLS antes do React/AdSense. */
export function buildAdSlotPlaceholderHtml(format: AdSlotFormat): string {
  const minH = AD_SLOT_MIN_HEIGHT[format];
  return `<aside aria-label="Espaço publicitário" class="ad-slot ad-slot--${format} w-full" style="min-height:${minH}px" data-ad-placeholder="true"><span class="sr-only">Publicidade</span></aside>`;
}
