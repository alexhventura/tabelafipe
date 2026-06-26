let capturedVehiclePrerenderHtml: string | null = null;
let hadVehiclePrerenderAtBoot = false;

export function captureVehiclePrerenderHtml(html: string): void {
  if (!html.trim()) return;
  capturedVehiclePrerenderHtml = html;
  hadVehiclePrerenderAtBoot = true;
}

export function getCapturedVehiclePrerenderHtml(): string | null {
  return capturedVehiclePrerenderHtml;
}

export function hadVehiclePrerenderShell(): boolean {
  return hadVehiclePrerenderAtBoot;
}

export function clearCapturedVehiclePrerender(): void {
  capturedVehiclePrerenderHtml = null;
}

/** Release reserved main height once React has painted final vehicle content. */
export function clearVehiclePrerenderMinHeight(): void {
  const main = document.querySelector('#root main');
  if (main) (main as HTMLElement).style.minHeight = '';
  document.documentElement.style.removeProperty('--vehicle-prerender-min-h');
}
