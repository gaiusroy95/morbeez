import type { StructuredAdvisory } from './types.js';
/**
 * Sanitize LLM/advisory output before WhatsApp farmer report.
 * - Reject diagnoses built on non-crop photos
 * - Never promote weather-only anthracnose as Contributing Factor without lesion evidence
 * - Deduplicate observation bullets
 */
export declare function sanitizeAdvisoryForFarmerWhatsApp(advisory: StructuredAdvisory): {
    advisory: StructuredAdvisory;
    blockDiagnosis: boolean;
    reason?: string;
};
//# sourceMappingURL=advisory-farmer-sanitize.util.d.ts.map