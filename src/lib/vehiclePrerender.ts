let capturedVehiclePrerenderHtml: string | null = null;
let hadStaticAppShellBoot = false;
let preservedVehicleMainMinHeightPx = 0;

export function captureVehiclePrerenderHtml(html: string): void {
  if (!html.trim()) return;
  capturedVehiclePrerenderHtml = html;
  hadStaticAppShellBoot = true;
}

export function markStaticAppShellBoot(): void {
  hadStaticAppShellBoot = true;
}

export function getCapturedVehiclePrerenderHtml(): string | null {
  return capturedVehiclePrerenderHtml;
}

export function hadVehiclePrerenderShell(): boolean {
  return hadStaticAppShellBoot;
}

export function hadStaticAppShellAtBoot(): boolean {
  return hadStaticAppShellBoot;
}

export function clearCapturedVehiclePrerender(): void {
  capturedVehiclePrerenderHtml = null;
}

/** Remember SSG main height before client render replaces `#root`. */
export function preserveVehicleMainMinHeight(px: number): void {
  if (px > 0) preservedVehicleMainMinHeightPx = px;
}

/** Re-apply min-height on React `main` after `createRoot` (full SSG). */
export function applyVehicleMainMinHeight(): void {
  if (preservedVehicleMainMinHeightPx <= 0) return;
  const main = document.querySelector('#root main');
  if (main) (main as HTMLElement).style.minHeight = `${preservedVehicleMainMinHeightPx}px`;
  document.documentElement.style.setProperty(
    '--vehicle-prerender-min-h',
    `${preservedVehicleMainMinHeightPx}px`,
  );
}

/** Release reserved main height once React has painted final vehicle content. */
export function clearVehiclePrerenderMinHeight(): void {
  const main = document.querySelector('#root main');
  if (main) (main as HTMLElement).style.minHeight = '';
  document.documentElement.style.removeProperty('--vehicle-prerender-min-h');
  preservedVehicleMainMinHeightPx = 0;
}
