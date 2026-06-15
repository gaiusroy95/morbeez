/**
 * Ensures @morbeez/shared staff clients use the same token as frontend/lib/api.ts (localStorage).
 * Call once on app boot and after login refresh.
 */
import { STAFF_TOKEN_KEY } from '@morbeez/shared';
import { getToken } from './api';

export function syncStaffSharedToken(): void {
  const token = getToken();
  if (token) {
    localStorage.setItem(STAFF_TOKEN_KEY, token);
    try {
      sessionStorage.setItem(STAFF_TOKEN_KEY, token);
    } catch {
      // ignore
    }
  }
}

/** @deprecated alias — use syncStaffSharedToken */
export const syncStaffSharedBridge = syncStaffSharedToken;

export function initStaffSharedBridge(): void {
  syncStaffSharedToken();
}
