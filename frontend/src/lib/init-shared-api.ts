import { setApiOrigin } from '@morbeez/shared';

/**
 * Pin API origin for @morbeez/shared clients (agronomistClient, staffApi, etc.).
 * Vite inlines VITE_API_BASE_URL here at build time — the shared package cannot
 * reliably read import.meta.env when consumed from packages/shared.
 */
export function initSharedApiConfig(): void {
  const url = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (url) setApiOrigin(url);
}
