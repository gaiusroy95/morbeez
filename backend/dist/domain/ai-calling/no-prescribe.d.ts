/** Common agrochemical / fertilizer names the voice engine must never volunteer. */
export declare const CHEMICAL_BLOCKLIST: string[];
export declare function findPrescriptionLeak(text: string): string | null;
export declare function assertNoPrescription(text: string, context: string): void;
export declare function stripPrescription(text: string): string;
//# sourceMappingURL=no-prescribe.d.ts.map