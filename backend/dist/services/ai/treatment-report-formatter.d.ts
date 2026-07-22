import type { StructuredAdvisory } from './types.js';
export declare const CONNECTED_PREVENTION_NONE_MESSAGE = "No connected preventive measures are currently recommended because no moderate or high secondary risks were identified.";
/** Farmer-facing "What To Do Now" block — primary treatment + mandatory connected prevention. */
export declare function buildTreatmentSection(advisory: StructuredAdvisory): string[];
/** Compact recommendation text for agronomist visit AI step. */
export declare function formatVisitRecommendationText(advisory: StructuredAdvisory): string;
//# sourceMappingURL=treatment-report-formatter.d.ts.map