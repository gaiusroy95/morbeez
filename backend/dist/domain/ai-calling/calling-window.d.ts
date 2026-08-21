import type { CallingWindow } from './types.js';
export type ConsentState = {
    dnd: boolean;
    optedOut: boolean;
    consentOutboundCall: boolean;
    staffInitiated: boolean;
};
/** Next 08:00 IST after `at` (or same morning if still before 08:00). */
export declare function nextCallingWindowStart(at: Date): Date;
export declare function isWithinCallingHours(at: Date, quietStartHour?: number, quietEndHour?: number): boolean;
export declare function evaluateCallingWindow(at: Date, consent: ConsentState): CallingWindow;
//# sourceMappingURL=calling-window.d.ts.map