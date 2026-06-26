const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6234467433781084';

let scheduled = false;

/** Load AdSense after first paint so vehicle pages keep TBT/LCP budget for content. */
export function deferAdsense(): void {
  if (scheduled || document.querySelector(`script[src="${ADSENSE_SRC}"]`)) return;
  scheduled = true;

  const load = () => {
    const script = document.createElement('script');
    script.async = true;
    script.src = ADSENSE_SRC;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(load, { timeout: 4000 });
  } else {
    setTimeout(load, 2500);
  }
}
