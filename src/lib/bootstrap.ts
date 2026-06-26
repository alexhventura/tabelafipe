import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import type { ReactElement } from 'react';

import { peekEmbeddedVehicleBundle, loadVehicleBundle } from './bundle';
import { deferAdsense } from './deferAdsense';
import { wrapInAppShell } from './staticShellHtml';
import {
  captureVehiclePrerenderHtml,
  getCapturedVehiclePrerenderHtml,
} from './vehiclePrerender';

function parseVehiclePath(): { marca: string; slug: string } | null {
  const match = window.location.pathname.match(/^\/fipe\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  return { marca: decodeURIComponent(match[1]), slug: decodeURIComponent(match[2]) };
}

function isFullVehicleSsg(container: HTMLElement): boolean {
  const hasShell = Boolean(container.querySelector('.min-h-screen footer.border-t'));
  const hasEmbed =
    Boolean(document.getElementById('__VEHICLE_BUNDLE__')) || Boolean(peekEmbeddedVehicleBundle());
  return hasShell && hasEmbed;
}

function findVehiclePrerenderNode(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-prerender="vehicle"]');
}

function capturePrerenderFromDom(container: HTMLElement): void {
  const node = findVehiclePrerenderNode(container);
  if (!node) return;
  captureVehiclePrerenderHtml(node.innerHTML);
}

/**
 * Production may serve partial prerender (`<main data-prerender>` only). Inject the same
 * static header/footer as SSG so the footer does not shift when React mounts Layout.
 */
function ensurePartialVehicleShell(container: HTMLElement): void {
  if (container.querySelector('.min-h-screen footer.border-t')) return;

  const prerenderEl = findVehiclePrerenderNode(container);
  if (!prerenderEl) return;

  capturePrerenderFromDom(container);

  let mainInner: string;
  if (prerenderEl.tagName === 'MAIN') {
    mainInner = `<div data-prerender="vehicle">${prerenderEl.innerHTML}</div>`;
  } else {
    mainInner = prerenderEl.outerHTML;
  }

  container.innerHTML = wrapInAppShell(mainInner);
}

function readPrerenderMinHeightPx(node: HTMLElement): number {
  const fromVar = getComputedStyle(document.documentElement)
    .getPropertyValue('--vehicle-prerender-min-h')
    .trim();
  if (fromVar) {
    const parsed = parseInt(fromVar, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return node.offsetHeight;
}

function preserveMainHeightForHydration(node: HTMLElement): void {
  const main = node.closest('main');
  if (!main) return;
  const minH = readPrerenderMinHeightPx(node);
  if (minH > 0) {
    main.style.minHeight = `${minH}px`;
  }
}

function stripPrerenderBeforeHydrate(container: HTMLElement): void {
  const node = findVehiclePrerenderNode(container);
  if (!node) return;
  if (!getCapturedVehiclePrerenderHtml()) {
    captureVehiclePrerenderHtml(node.innerHTML);
  }
  preserveMainHeightForHydration(node);
  node.remove();
}

async function prefetchVehicleBundle(): Promise<void> {
  if (peekEmbeddedVehicleBundle()) return;
  const params = parseVehiclePath();
  if (!params) return;
  const bundle = await loadVehicleBundle(params.marca, params.slug);
  if (bundle) {
    (window as Window & { __VEHICLE_BUNDLE__?: unknown }).__VEHICLE_BUNDLE__ = bundle;
  }
}

export async function mountApp(container: HTMLElement, app: ReactElement): Promise<Root> {
  const vehicleParams = parseVehiclePath();
  const hasVehiclePrerender = Boolean(findVehiclePrerenderNode(container));

  if (vehicleParams && hasVehiclePrerender) {
    const fullSsg = isFullVehicleSsg(container);

    if (!fullSsg) {
      ensurePartialVehicleShell(container);
      stripPrerenderBeforeHydrate(container);
    } else {
      capturePrerenderFromDom(container);
      const prerenderNode = findVehiclePrerenderNode(container);
      if (prerenderNode) preserveMainHeightForHydration(prerenderNode);
    }

    const prefetch = peekEmbeddedVehicleBundle() ? Promise.resolve() : prefetchVehicleBundle();
    await prefetch;

    const root = hydrateRoot(container, app);
    deferAdsense();
    return root;
  }

  if (container.firstElementChild) {
    const root = hydrateRoot(container, app);
    deferAdsense();
    return root;
  }

  const root = createRoot(container);
  root.render(app);
  deferAdsense();
  return root;
}
