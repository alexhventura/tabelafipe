import { useEffect, useRef } from 'react';
import {
  ADSENSE_CLIENT,
  AD_SLOT_MIN_HEIGHT,
  type AdSlotFormat,
} from '../../lib/adsenseConfig';
import { onAdsenseReady } from '../../lib/deferAdsense';
import { pushAdSenseSlot } from '../../lib/hydrateAdSlots';

interface AdSlotProps {
  /** ID do bloco no painel AdSense. Sem ID, apenas reserva espaço (zero CLS). */
  slotId?: string;
  format: AdSlotFormat;
  className?: string;
}

export default function AdSlot({ slotId, format, className = '' }: AdSlotProps) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);
  const minHeight = AD_SLOT_MIN_HEIGHT[format];

  useEffect(() => {
    if (!slotId || pushedRef.current) return;

    onAdsenseReady(() => {
      if (!insRef.current || pushedRef.current) return;
      try {
        window.adsbygoogle = window.adsbygoogle ?? [];
        pushAdSenseSlot(insRef.current);
        pushedRef.current = true;
      } catch {
        /* AdSense may reject duplicate pushes */
      }
    });
  }, [slotId]);

  return (
    <aside
      aria-label="Espaço publicitário"
      className={`ad-slot ad-slot--${format} w-full flex items-center justify-center ${className}`}
      style={{ minHeight }}
    >
      {slotId ? (
        <ins
          ref={insRef}
          className="adsbygoogle block w-full"
          style={{ display: 'block', minHeight }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <span className="sr-only">Publicidade</span>
      )}
    </aside>
  );
}
