import { ADSENSE_CLIENT, AD_SLOTS, AD_SLOT_MIN_HEIGHT, type AdSlotFormat } from './adsenseConfig';
import { onAdsenseReady } from './deferAdsense';

const FORMAT_TO_SLOT: Record<AdSlotFormat, string> = {
  leaderboard: AD_SLOTS.vehicleLeaderboard,
  rectangle: AD_SLOTS.vehicleRectangle,
  'large-rectangle': AD_SLOTS.vehicleBottom,
};

function formatFromElement(el: Element): AdSlotFormat | null {
  if (el.classList.contains('ad-slot--leaderboard')) return 'leaderboard';
  if (el.classList.contains('ad-slot--rectangle')) return 'rectangle';
  if (el.classList.contains('ad-slot--large-rectangle')) return 'large-rectangle';
  return null;
}

export function pushAdSenseSlot(ins: HTMLElement): void {
  window.adsbygoogle = window.adsbygoogle ?? [];
  window.adsbygoogle.push({});
}

/**
 * Converts SSG ad placeholders into live AdSense units after script load.
 * Keeps reserved min-height so CLS stays at zero.
 */
export function hydrateAdSlots(root: ParentNode = document): void {
  const placeholders = root.querySelectorAll<HTMLElement>('[data-ad-placeholder="true"]');
  if (!placeholders.length) return;

  placeholders.forEach((placeholder) => {
    if (placeholder.dataset.adHydrated === '1') return;

    const format = formatFromElement(placeholder);
    if (!format) return;

    const slotId = FORMAT_TO_SLOT[format];
    if (!slotId) return;

    onAdsenseReady(() => {
      if (placeholder.dataset.adHydrated === '1' || placeholder.querySelector('ins.adsbygoogle')) return;

      const minHeight = AD_SLOT_MIN_HEIGHT[format];
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle block w-full';
      ins.style.display = 'block';
      ins.style.minHeight = `${minHeight}px`;
      ins.setAttribute('data-ad-client', ADSENSE_CLIENT);
      ins.setAttribute('data-ad-slot', slotId);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');

      placeholder.replaceChildren(ins);
      placeholder.dataset.adHydrated = '1';

      try {
        pushAdSenseSlot(ins);
      } catch {
        /* duplicate push or blocked client */
      }
    });
  });
}

export function scheduleAdSlotHydration(root: ParentNode = document): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => hydrateAdSlots(root));
  });
}
