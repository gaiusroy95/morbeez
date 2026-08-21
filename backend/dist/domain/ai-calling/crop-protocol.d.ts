import type { CropProtocolMatch } from './types.js';
export declare const DEFAULT_HEALTH_FOLLOW_UP_DAYS: readonly [1, 3, 7];
export declare function daysAfterPlanting(plantingDateIso: string, onDate?: Date): number | null;
export declare function matchProtocolForDap(protocols: CropProtocolMatch[], cropType: string, dap: number): CropProtocolMatch | null;
export declare function healthFollowUpAt(from: Date, dayOffset: number): Date;
export declare function isApplicationDue(protocol: CropProtocolMatch, dap: number): boolean;
//# sourceMappingURL=crop-protocol.d.ts.map