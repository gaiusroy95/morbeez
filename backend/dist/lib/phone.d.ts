/** Normalize Indian mobile to E.164 without + prefix (e.g. 919876543210) */
export declare function normalizePhone(phone: string): string;
export declare function isValidIndianPhone(phone: string): boolean;
/** Meta WhatsApp wa_id — often 10-digit Indian mobile without country code. */
export declare function normalizeWhatsAppWaId(waId: string): string;
/**
 * Display / dial form with leading "+", e.g. +916282873542.
 * - 10-digit local India → +91…
 * - Already country-coded digits → +…
 */
export declare function formatPhoneE164(phone: string | null | undefined, defaultCountryCode?: string): string | null;
//# sourceMappingURL=phone.d.ts.map