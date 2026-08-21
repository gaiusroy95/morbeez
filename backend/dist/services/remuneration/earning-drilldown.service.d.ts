import { type MonthBucket } from '../../domain/remuneration/earning-drilldown.js';
export declare const earningDrilldownService: {
    lastThreeMonths(asOf?: Date): string[];
    forParty(partyType: "partner" | "employee", partyId: string, months?: string[]): Promise<{
        months: MonthBucket[];
        dueNow: number;
        heldNow: number;
    }>;
};
export type { MonthBucket };
//# sourceMappingURL=earning-drilldown.service.d.ts.map