import { ADSENSE_CLIENT } from './adsenseConfig';

const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

let loadScheduled = false;
let loaded = false;
const readyCallbacks: Array<() => void> = [];

function flushReady(): void {
  if (loaded) return;
  loaded = true;
  readyCallbacks.splice(0).forEach((cb) => {
    try {
      cb();
    } catch {
      /* ignore ad push errors */
    }
  });
}

function injectScript(): void {
  if (document.querySelector(`script[src*="adsbygoogle.js"]`)) {
    flushReady();
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = ADSENSE_SRC;
  script.crossOrigin = 'anonymous';
  script.onload = () => flushReady();
  script.onerror = () => flushReady();
  document.head.appendChild(script);
}

/** Register callback when adsbygoogle.js is available (loads after interaction or idle fallback). */
export function onAdsenseReady(callback: () => void): void {
  if (loaded) {
    callback();
    return;
  }
  readyCallbacks.push(callback);
  deferAdsense();
}

/**
 * Load AdSense after first user interaction (scroll, click, touch, key)
 * or on idle timeout — keeps TBT/LCP budget for vehicle content on first paint.
 */
export function deferAdsense(): void {
  if (loadScheduled) return;
  loadScheduled = true;

  let triggered = false;
  const trigger = () => {
    if (triggered) return;
    triggered = true;
    cleanup();
    injectScript();
  };

  const cleanup = () => {
    for (const [event, handler, options] of listeners) {
      window.removeEventListener(event, handler, options);
    }
    if (idleId != null && 'cancelIdleCallback' in window) {
      cancelIdleCallback(idleId);
    }
    if (fallbackTimer != null) {
      clearTimeout(fallbackTimer);
    }
  };

  const listeners: [string, () => void, AddEventListenerOptions?][] = [
    ['scroll', trigger, { passive: true }],
    ['pointerdown', trigger],
    ['keydown', trigger],
    ['touchstart', trigger, { passive: true }],
  ];

  for (const [event, handler, options] of listeners) {
    window.addEventListener(event, handler, options);
  }

  let idleId: number | undefined;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

  if ('requestIdleCallback' in window) {
    idleId = requestIdleCallback(trigger, { timeout: 5000 });
  } else {
    fallbackTimer = setTimeout(trigger, 4500);
  }
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}
