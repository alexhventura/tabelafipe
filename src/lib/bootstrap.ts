import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import type { ReactElement } from 'react';

import { peekEmbeddedVehicleBundle, loadVehicleBundle } from './bundle';
import { deferAdsense } from './deferAdsense';
import { scheduleAdSlotHydration } from './hydrateAdSlots';
import { wrapInAppShell } from './staticShellHtml';
import {
  applyVehicleMainMinHeight,
  captureVehiclePrerenderHtml,
  markStaticAppShellBoot,
  preserveVehicleMainMinHeight,
} from './vehiclePrerender';

function parseVehiclePath(): { marca: string; slug: string } | null {
  const match = window.location.pathname.match(/^\/fipe\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  return { marca: decodeURIComponent(match[1]), slug: decodeURIComponent(match[2]) };
}

function hasStaticAppShell(container: HTMLElement): boolean {
  return Boolean(container.querySelector('.min-h-screen footer.border-t'));
}

function findPrerenderNode(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-prerender]');
}

function isFullVehicleSsg(container: HTMLElement): boolean {
  const prerender = findPrerenderNode(container);
  const hasEmbed =
    Boolean(document.getElementById('__VEHICLE_BUNDLE__')) || Boolean(peekEmbeddedVehicleBundle());
  return prerender?.getAttribute('data-prerender') === 'vehicle' && hasEmbed;
}

function findVehiclePrerenderNode(container: HTMLElement): HTMLElement | null {
  const node = findPrerenderNode(container);
  return node?.getAttribute('data-prerender') === 'vehicle' ? node : null;
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
    preserveVehicleMainMinHeight(minH);
  }
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

/** SSG pages ship a static shell; render React inside `<main>` to avoid hydration mismatch (#418). */
function clientMountInMain(container: HTMLElement, app: ReactElement): Root {
  markStaticAppShellBoot();
  const mainEl = container.querySelector('main');
  const mountTarget = mainEl ?? container;
  const root = createRoot(mountTarget);
  root.render(app);
  deferAdsense();
  scheduleAdSlotHydration(container);
  return root;
}

export async function mountApp(container: HTMLElement, app: ReactElement): Promise<Root> {
  const vehicleParams = parseVehiclePath();
  const prerenderNode = findPrerenderNode(container);
  const staticShell = hasStaticAppShell(container);

  if (vehicleParams && prerenderNode?.getAttribute('data-prerender') === 'vehicle') {
    const fullSsg = isFullVehicleSsg(container);

    if (!fullSsg) {
      ensurePartialVehicleShell(container);
      const vehicleNode = findVehiclePrerenderNode(container);
      if (vehicleNode) preserveMainHeightForHydration(vehicleNode);
    } else {
      capturePrerenderFromDom(container);
      const vehicleNode = findVehiclePrerenderNode(container);
      if (vehicleNode) preserveMainHeightForHydration(vehicleNode);
    }

    const prefetch = peekEmbeddedVehicleBundle() ? Promise.resolve() : prefetchVehicleBundle();
    await prefetch;

    if (fullSsg || staticShell) {
      const root = clientMountInMain(container, app);
      applyVehicleMainMinHeight();
      return root;
    }

    const root = hydrateRoot(container, app);
    deferAdsense();
    scheduleAdSlotHydration(container);
    return root;
  }

  if (staticShell && prerenderNode) {
    return clientMountInMain(container, app);
  }

  if (container.firstElementChild) {
    const root = hydrateRoot(container, app);
    deferAdsense();
    scheduleAdSlotHydration(container);
    return root;
  }

  const root = createRoot(container);
  root.render(app);
  deferAdsense();
  scheduleAdSlotHydration(container);
  return root;
}
